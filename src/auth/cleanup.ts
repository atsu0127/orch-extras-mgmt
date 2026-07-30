import { lt, lte } from 'drizzle-orm'
import type { Db } from '../db/client'
import { loginAttempts, sessions } from '../db/schema'

const LOGIN_ATTEMPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export function buildAuthCleanupStatements(db: Db, now: Date) {
  const cutoff = new Date(
    now.getTime() - LOGIN_ATTEMPT_RETENTION_MS,
  ).toISOString()

  return [
    db.delete(sessions).where(lte(sessions.expiresAt, now.toISOString())),
    db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, cutoff)),
  ] as const
}

export async function cleanupAuthData(db: Db, now: Date): Promise<void> {
  await db.batch(buildAuthCleanupStatements(db, now))
}
