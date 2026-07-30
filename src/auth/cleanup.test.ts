import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import { credentials, loginAttempts, sessions } from '../db/schema'
import { createTestDb } from '../test/db'
import { buildAuthCleanupStatements, cleanupAuthData } from './cleanup'

const NOW = new Date('2026-07-30T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

let db: Db

beforeEach(() => {
  db = createTestDb()
})

async function runCleanupStatements() {
  const statements = buildAuthCleanupStatements(db, NOW)
  for (const statement of statements) {
    await statement
  }
}

function installBatchAdapter(batch: ReturnType<typeof vi.fn>) {
  Object.defineProperty(db, 'batch', {
    configurable: true,
    value: batch,
  })
}

describe('buildAuthCleanupStatements', () => {
  it('期限切れと現在時刻ちょうどのセッションを削除し、有効なセッションを残す', async () => {
    await db.insert(sessions).values([
      {
        id: 'expired',
        role: 'admin',
        expiresAt: new Date(NOW.getTime() - 1).toISOString(),
      },
      { id: 'exact-now', role: 'extra', expiresAt: NOW.toISOString() },
      {
        id: 'active',
        role: 'admin',
        expiresAt: new Date(NOW.getTime() + 1).toISOString(),
      },
    ])

    await runCleanupStatements()

    await expect(
      db.select({ id: sessions.id }).from(sessions).orderBy(asc(sessions.id)),
    ).resolves.toEqual([{ id: 'active' }])
  })

  it('7日より古いログイン試行だけを成功・失敗に関係なく削除する', async () => {
    const at = (daysAgo: number) =>
      new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()
    await db.insert(loginAttempts).values([
      { ip: '8-days-failure', attemptedAt: at(8), success: false },
      { ip: '8-days-success', attemptedAt: at(8), success: true },
      { ip: '7-days-failure', attemptedAt: at(7), success: false },
      { ip: '7-days-success', attemptedAt: at(7), success: true },
      { ip: '6-days-failure', attemptedAt: at(6), success: false },
      { ip: '6-days-success', attemptedAt: at(6), success: true },
    ])

    await runCleanupStatements()

    await expect(
      db
        .select({ ip: loginAttempts.ip, success: loginAttempts.success })
        .from(loginAttempts)
        .orderBy(asc(loginAttempts.id)),
    ).resolves.toEqual([
      { ip: '7-days-failure', success: false },
      { ip: '7-days-success', success: true },
      { ip: '6-days-failure', success: false },
      { ip: '6-days-success', success: true },
    ])
  })

  it('掃除対象ではない認証情報を残す', async () => {
    await db.insert(credentials).values({
      role: 'admin',
      passwordHash: 'stored-hash',
    })

    await runCleanupStatements()

    await expect(
      db
        .select({
          role: credentials.role,
          passwordHash: credentials.passwordHash,
        })
        .from(credentials),
    ).resolves.toEqual([{ role: 'admin', passwordHash: 'stored-hash' }])
  })
})

describe('cleanupAuthData', () => {
  it('2文を1回のbatchで実行し、削除境界を反映する', async () => {
    const at = (daysAgo: number) =>
      new Date(NOW.getTime() - daysAgo * DAY_MS).toISOString()
    await db.insert(sessions).values([
      {
        id: 'expired',
        role: 'admin',
        expiresAt: new Date(NOW.getTime() - 1).toISOString(),
      },
      {
        id: 'active',
        role: 'extra',
        expiresAt: new Date(NOW.getTime() + 1).toISOString(),
      },
    ])
    await db.insert(loginAttempts).values([
      { ip: '8-days', attemptedAt: at(8), success: false },
      { ip: '7-days', attemptedAt: at(7), success: true },
    ])

    // sqlite-proxy は batch 非対応なので、このテスト内だけD1成功時を逐次実行で模倣する。
    const batch = vi.fn(
      async (statements: ReturnType<typeof buildAuthCleanupStatements>) => {
        for (const statement of statements) {
          await statement
        }
        return []
      },
    )
    installBatchAdapter(batch)

    await cleanupAuthData(db, NOW)

    expect(batch).toHaveBeenCalledTimes(1)
    expect(batch.mock.calls[0]?.[0]).toHaveLength(2)
    await expect(
      db.select({ id: sessions.id }).from(sessions).orderBy(asc(sessions.id)),
    ).resolves.toEqual([{ id: 'active' }])
    await expect(
      db.select({ ip: loginAttempts.ip }).from(loginAttempts),
    ).resolves.toEqual([{ ip: '7-days' }])
  })

  it('batchの失敗を呼び出し元へ伝播する', async () => {
    const failure = new Error('batch failed')
    const batch = vi.fn().mockRejectedValue(failure)
    installBatchAdapter(batch)

    await expect(cleanupAuthData(db, NOW)).rejects.toBe(failure)
    expect(batch).toHaveBeenCalledTimes(1)
  })
})
