import { and, eq, gt } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type Role, sessions } from '../db/schema'
import { toHex } from './hex'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * 有効期限の延長と `last_seen_at` の更新を間引く間隔（設計書8.3）。
 * 読み取りのたびに書き込むと D1 の書き込みが利用者数に対して不相応に増える。
 */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

export type ActiveSession = {
  id: string
  role: Role
}

/**
 * Cookie に入れる生トークン。DB にはこれを SHA-256 したものだけを置くので、
 * DB が漏れてもセッションを乗っ取られない（設計書8.3）。
 */
export function createSessionToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return toHex(new Uint8Array(digest))
}

/** 生トークンを返す。呼び出し側はこれを Cookie に入れる */
export async function issueSession(
  db: Db,
  role: Role,
  now: Date,
): Promise<string> {
  const token = createSessionToken()
  const issuedAt = now.toISOString()

  await db.insert(sessions).values({
    id: await hashSessionToken(token),
    role,
    createdAt: issuedAt,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    lastSeenAt: issuedAt,
  })

  return token
}

export async function resolveSession(
  db: Db,
  token: string,
  now: Date,
): Promise<ActiveSession | null> {
  const id = await hashSessionToken(token)
  const [row] = await db
    .select({
      id: sessions.id,
      role: sessions.role,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    // 期限切れは SQL 側で落とす。取得後に判定すると条件の付け忘れが起きやすい
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now.toISOString())))
    .limit(1)

  if (!row) return null

  if (now.getTime() - Date.parse(row.lastSeenAt) >= REFRESH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({
        lastSeenAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
      })
      .where(eq(sessions.id, id))
  }

  return { id: row.id, role: row.role }
}

export async function revokeSession(db: Db, id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id))
}

/** パスワード変更時に、そのロールのログインをすべて無効にする（設計書8.3） */
export async function revokeSessionsForRole(db: Db, role: Role): Promise<void> {
  await db.delete(sessions).where(eq(sessions.role, role))
}
