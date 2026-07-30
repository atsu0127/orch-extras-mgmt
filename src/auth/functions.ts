import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Db } from '../db/client'
import { getDb } from '../db/client'
import { credentials } from '../db/schema'
import { ROLES, type Role } from '../lib/roles'
import { getClientIp } from './client-ip'
import {
  clearSessionCookie,
  readSessionCookie,
  writeSessionCookie,
} from './cookie'
import { requireAuth } from './middleware'
import { verifyPassword } from './password'
import { isLoginBlocked, recordLoginAttempt } from './rate-limit'
import { issueSession, resolveSession, revokeSession } from './session'

/**
 * ロールの行が欠けていても HMAC の計算を省かないための当て馬。
 * 早期に false を返すと、応答時間から行の有無が分かってしまう。
 */
const ABSENT_ROLE_HASH = `hmac-sha256$v1$${'0'.repeat(64)}`

const loginInput = z.object({
  password: z.string().min(1).max(200),
})

export type LoginResult =
  | { ok: true; role: Role }
  | { ok: false; reason: 'invalid' | 'rate_limited' }

export type CurrentSession = { role: Role }

/**
 * セッションの有無を返すだけの、ログイン前でも呼べる入口。
 * 画面側の誘導（設計書8.4の2層目）に使う。
 */
export const getCurrentSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentSession | null> => {
    const token = readSessionCookie()
    if (!token) return null

    const session = await resolveSession(getDb(), token, new Date())
    return session ? { role: session.role } : null
  },
)

export const login = createServerFn({ method: 'POST' })
  .validator(loginInput)
  .handler(async ({ data }): Promise<LoginResult> => {
    const db = getDb()
    const ip = getClientIp()
    const now = new Date()

    if (await isLoginBlocked(db, ip, now)) {
      return { ok: false, reason: 'rate_limited' }
    }

    const role = await identifyRole(db, data.password)
    await recordLoginAttempt(db, ip, role !== null, now)
    if (!role) return { ok: false, reason: 'invalid' }

    writeSessionCookie(await issueSession(db, role, now))
    return { ok: true, role }
  })

export const logout = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await revokeSession(getDb(), context.session.id)
    clearSessionCookie()
  })

/**
 * ログイン画面ではロールを選ばせないため、入力を両方のハッシュと照合して
 * 一致した側を採る（設計書8.1）。片方が一致した時点で打ち切ると、
 * 応答時間の差からどちらのパスワードだったのかが漏れる。
 */
async function identifyRole(db: Db, password: string): Promise<Role | null> {
  const pepper = env.PASSWORD_PEPPER
  const stored = await db
    .select({ role: credentials.role, hash: credentials.passwordHash })
    .from(credentials)

  const hashes = new Map(stored.map((row) => [row.role, row.hash]))
  const matches = await Promise.all(
    ROLES.map((role) =>
      verifyPassword(password, hashes.get(role) ?? ABSENT_ROLE_HASH, pepper),
    ),
  )

  // 両ロールに同じパスワードが設定されていた場合は ROLES の順（admin が先）で決まる
  return ROLES[matches.indexOf(true)] ?? null
}
