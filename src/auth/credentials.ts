import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { credentials } from '../db/schema'
import type { Role } from '../lib/roles'
import { hashPassword, verifyPassword } from './password'
import { revokeSessionsForRole } from './session'

export type CredentialSummary = {
  role: Role
  updatedAt: string
}

/** 設定画面で「いつ変えたか」を出すために使う。ハッシュは返さない */
export function listCredentials(db: Db): Promise<Array<CredentialSummary>> {
  return db
    .select({ role: credentials.role, updatedAt: credentials.updatedAt })
    .from(credentials)
}

/** 行が無いロールは常に不一致とする。パスワードが無いなら誰も名乗れない */
export async function verifyRolePassword(
  db: Db,
  role: Role,
  password: string,
): Promise<boolean> {
  const [row] = await db
    .select({ hash: credentials.passwordHash })
    .from(credentials)
    .where(eq(credentials.role, role))
    .limit(1)
  if (!row) return false

  return verifyPassword(password, row.hash, env.PASSWORD_PEPPER)
}

/**
 * 変更したロールのログインをすべて無効にする（設計書8.3）。古いパスワードを
 * 知っている人が開いたままのタブで入り続けられては、変更した意味がない。
 *
 * 行が無ければ作る。パスワードを設定できない状態から抜け出せなくなるのを避ける。
 */
export async function changePassword(
  db: Db,
  role: Role,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password, env.PASSWORD_PEPPER)
  // $onUpdateFn は update のときだけ働くので、upsert では自分で入れる
  const updatedAt = new Date().toISOString()

  await db
    .insert(credentials)
    .values({ role, passwordHash, updatedAt })
    .onConflictDoUpdate({
      target: credentials.role,
      set: { passwordHash, updatedAt },
    })

  await revokeSessionsForRole(db, role)
}
