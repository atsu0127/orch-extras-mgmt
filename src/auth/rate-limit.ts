import { and, count, eq, gte } from 'drizzle-orm'
import type { Db } from '../db/client'
import { loginAttempts } from '../db/schema'

/** 直近この時間の失敗だけを数える。古い行は Cron で掃除する（設計書8.5） */
export const WINDOW_MS = 5 * 60 * 1000
export const MAX_FAILURES = 10

/**
 * 窓が滑っていくので、拒否は最後の失敗から5分で自然に解ける。
 * 解除の時刻を別に持たなくてよい。
 */
export async function isLoginBlocked(
  db: Db,
  ip: string,
  now: Date,
): Promise<boolean> {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString()
  const [row] = await db
    .select({ failures: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ip, ip),
        eq(loginAttempts.success, false),
        gte(loginAttempts.attemptedAt, since),
      ),
    )

  return (row?.failures ?? 0) >= MAX_FAILURES
}

export async function recordLoginAttempt(
  db: Db,
  ip: string,
  success: boolean,
  now: Date,
): Promise<void> {
  await db.insert(loginAttempts).values({
    ip,
    success,
    attemptedAt: now.toISOString(),
  })
}
