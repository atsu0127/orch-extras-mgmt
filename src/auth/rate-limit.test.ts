import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { createTestDb } from '../test/db'
import {
  isLoginBlocked,
  MAX_FAILURES,
  recordLoginAttempt,
  WINDOW_MS,
} from './rate-limit'

const NOW = new Date('2026-07-26T00:00:00.000Z')
const IP = '203.0.113.10'

let db: Db

beforeEach(() => {
  db = createTestDb()
})

function nowPlus(millis: number): Date {
  return new Date(NOW.getTime() + millis)
}

async function fail(times: number, at: Date, ip = IP) {
  for (let i = 0; i < times; i++) {
    await recordLoginAttempt(db, ip, false, at)
  }
}

describe('isLoginBlocked', () => {
  it('試行が無ければ通す', async () => {
    await expect(isLoginBlocked(db, IP, NOW)).resolves.toBe(false)
  })

  it('上限の1回手前までは通す', async () => {
    await fail(MAX_FAILURES - 1, NOW)

    await expect(isLoginBlocked(db, IP, NOW)).resolves.toBe(false)
  })

  it('5分のうちに10回失敗すると拒否する', async () => {
    await fail(MAX_FAILURES, NOW)

    await expect(isLoginBlocked(db, IP, nowPlus(WINDOW_MS - 1))).resolves.toBe(
      true,
    )
  })

  it('窓から外れた失敗は数えない', async () => {
    await fail(MAX_FAILURES, NOW)

    await expect(isLoginBlocked(db, IP, nowPlus(WINDOW_MS + 1))).resolves.toBe(
      false,
    )
  })

  it('成功した試行は数えない', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) {
      await recordLoginAttempt(db, IP, true, NOW)
    }

    await expect(isLoginBlocked(db, IP, NOW)).resolves.toBe(false)
  })

  it('別の IP の失敗に巻き込まれない', async () => {
    await fail(MAX_FAILURES, NOW, '198.51.100.7')

    await expect(isLoginBlocked(db, IP, NOW)).resolves.toBe(false)
  })
})
