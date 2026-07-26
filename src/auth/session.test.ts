import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { sessions } from '../db/schema'
import { createTestDb } from '../test/db'
import {
  createSessionToken,
  hashSessionToken,
  issueSession,
  resolveSession,
  revokeSession,
  revokeSessionsForRole,
  SESSION_TTL_MS,
} from './session'

const NOW = new Date('2026-07-26T00:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

let db: Db

beforeEach(() => {
  db = createTestDb()
})

function nowPlus(millis: number): Date {
  return new Date(NOW.getTime() + millis)
}

function readRow(id: string) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get()
}

describe('createSessionToken', () => {
  it('32バイト分の16進文字列を返す', () => {
    expect(createSessionToken()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('呼ぶたびに異なる', () => {
    expect(createSessionToken()).not.toBe(createSessionToken())
  })
})

describe('issueSession', () => {
  it('生トークンではなくハッシュを保存する', async () => {
    const token = await issueSession(db, 'admin', NOW)

    const stored = await readRow(await hashSessionToken(token))
    expect(stored).toBeDefined()
    expect(stored?.role).toBe('admin')
    await expect(readRow(token)).resolves.toBeUndefined()
  })

  it('30日後を有効期限にする', async () => {
    const token = await issueSession(db, 'extra', NOW)

    const stored = await readRow(await hashSessionToken(token))
    expect(stored?.expiresAt).toBe(nowPlus(SESSION_TTL_MS).toISOString())
  })
})

describe('resolveSession', () => {
  it('有効なトークンならロールを返す', async () => {
    const token = await issueSession(db, 'extra', NOW)

    await expect(
      resolveSession(db, token, nowPlus(DAY_MS)),
    ).resolves.toMatchObject({ role: 'extra' })
  })

  it('期限切れなら弾く', async () => {
    const token = await issueSession(db, 'admin', NOW)

    await expect(
      resolveSession(db, token, nowPlus(SESSION_TTL_MS + 1)),
    ).resolves.toBeNull()
  })

  it('知らないトークンなら弾く', async () => {
    await issueSession(db, 'admin', NOW)

    await expect(
      resolveSession(db, createSessionToken(), NOW),
    ).resolves.toBeNull()
  })

  it('1日以内の再訪では期限を延長しない', async () => {
    const token = await issueSession(db, 'admin', NOW)
    const id = await hashSessionToken(token)
    const issued = await readRow(id)

    await resolveSession(db, token, nowPlus(DAY_MS - 1))

    const stored = await readRow(id)
    expect(stored?.expiresAt).toBe(issued?.expiresAt)
    expect(stored?.lastSeenAt).toBe(issued?.lastSeenAt)
  })

  it('1日以上あいた再訪では期限を延長する', async () => {
    const token = await issueSession(db, 'admin', NOW)
    const id = await hashSessionToken(token)
    const revisit = nowPlus(DAY_MS)

    await resolveSession(db, token, revisit)

    const stored = await readRow(id)
    expect(stored?.lastSeenAt).toBe(revisit.toISOString())
    expect(stored?.expiresAt).toBe(
      new Date(revisit.getTime() + SESSION_TTL_MS).toISOString(),
    )
  })
})

describe('revokeSession', () => {
  it('破棄したセッションは解決できなくなる', async () => {
    const token = await issueSession(db, 'admin', NOW)

    await revokeSession(db, await hashSessionToken(token))

    await expect(resolveSession(db, token, NOW)).resolves.toBeNull()
  })
})

describe('revokeSessionsForRole', () => {
  it('指定したロールだけをまとめて失効させる', async () => {
    const admin = await issueSession(db, 'admin', NOW)
    const extra = await issueSession(db, 'extra', NOW)

    await revokeSessionsForRole(db, 'admin')

    await expect(resolveSession(db, admin, NOW)).resolves.toBeNull()
    await expect(resolveSession(db, extra, NOW)).resolves.toMatchObject({
      role: 'extra',
    })
  })
})
