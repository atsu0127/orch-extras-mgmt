import { count, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { aiAskAttempts, aiUsageDaily } from '../db/schema'
import { ASSISTANT_LIMITS, ASSISTANT_MODEL } from '../lib/assistant'
import { todayInJst } from '../lib/date'
import { createTestDb } from '../test/db'
import { reserveAssistantQuota } from './quota'
import { listDailyUsage } from './usage'

const NOW = new Date('2026-08-16T14:00:00.000Z')
const IP = '203.0.113.10'

let db: Db

beforeEach(() => {
  db = createTestDb()
})

function nowPlus(millis: number): Date {
  return new Date(NOW.getTime() + millis)
}

async function reserve(
  times: number,
  at: Date,
  ip = IP,
): Promise<Array<Awaited<ReturnType<typeof reserveAssistantQuota>>>> {
  const results: Array<Awaited<ReturnType<typeof reserveAssistantQuota>>> = []
  for (let index = 0; index < times; index += 1) {
    results.push(await reserveAssistantQuota(db, { ip, now: at }))
  }
  return results
}

async function attemptCount(ip = IP): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(aiAskAttempts)
    .where(eq(aiAskAttempts.ip, ip))
  return row?.count ?? 0
}

describe('reserveAssistantQuota', () => {
  it('上限の1回手前までは通し、16問目は ip_limited にする', async () => {
    const passed = await reserve(ASSISTANT_LIMITS.ipQuestionsMax, NOW)
    expect(passed.every((result) => result === 'ok')).toBe(true)
    expect(await attemptCount()).toBe(ASSISTANT_LIMITS.ipQuestionsMax)

    await expect(reserveAssistantQuota(db, { ip: IP, now: NOW })).resolves.toBe(
      'ip_limited',
    )
    expect(await attemptCount()).toBe(ASSISTANT_LIMITS.ipQuestionsMax)
  })

  it('窓から外れた試行は数えない', async () => {
    await reserve(ASSISTANT_LIMITS.ipQuestionsMax, NOW)

    await expect(
      reserveAssistantQuota(db, {
        ip: IP,
        now: nowPlus(ASSISTANT_LIMITS.ipWindowMs - 1),
      }),
    ).resolves.toBe('ip_limited')

    await expect(
      reserveAssistantQuota(db, {
        ip: IP,
        now: nowPlus(ASSISTANT_LIMITS.ipWindowMs + 1),
      }),
    ).resolves.toBe('ok')
  })

  it('別の IP の確保に巻き込まれない', async () => {
    await reserve(ASSISTANT_LIMITS.ipQuestionsMax, NOW, '198.51.100.7')

    await expect(reserveAssistantQuota(db, { ip: IP, now: NOW })).resolves.toBe(
      'ok',
    )
  })

  it('全体80問まで通し、81問目は daily_limited で IP 行も足さない', async () => {
    for (
      let index = 0;
      index < ASSISTANT_LIMITS.dailyQuestionsMax;
      index += 1
    ) {
      const result = await reserveAssistantQuota(db, {
        ip: `203.0.113.${index}`,
        now: NOW,
      })
      expect(result).toBe('ok')
    }

    const before = await attemptCount('198.51.100.80')
    await expect(
      reserveAssistantQuota(db, { ip: '198.51.100.80', now: NOW }),
    ).resolves.toBe('daily_limited')
    expect(await attemptCount('198.51.100.80')).toBe(before)

    const [usage] = await listDailyUsage(db)
    expect(usage).toMatchObject({
      usageDate: todayInJst(NOW),
      model: ASSISTANT_MODEL,
      acceptedQuestionCount: ASSISTANT_LIMITS.dailyQuestionsMax,
    })
  })

  it('日本時間の0時をまたぐと全体枠が戻る', async () => {
    for (
      let index = 0;
      index < ASSISTANT_LIMITS.dailyQuestionsMax;
      index += 1
    ) {
      await reserveAssistantQuota(db, {
        ip: `203.0.113.${index}`,
        now: NOW,
      })
    }

    const nextDay = new Date('2026-08-16T15:00:00.000Z')
    await expect(
      reserveAssistantQuota(db, { ip: IP, now: nextDay }),
    ).resolves.toBe('ok')

    const rows = await listDailyUsage(db)
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          usageDate: '2026-08-16',
          acceptedQuestionCount: ASSISTANT_LIMITS.dailyQuestionsMax,
        }),
        expect.objectContaining({
          usageDate: '2026-08-17',
          acceptedQuestionCount: 1,
        }),
      ]),
    )
  })

  it('JST の日付境界で usage_date を切る', async () => {
    const cases: Array<[string, string]> = [
      ['2026-08-16T14:59:59.999Z', '2026-08-16'],
      ['2026-08-16T15:00:00.000Z', '2026-08-17'],
      ['2026-08-17T12:00:00.000Z', '2026-08-17'],
      ['2026-08-17T15:30:00.000Z', '2026-08-18'],
    ]

    for (const [iso, usageDate] of cases) {
      const isolated = createTestDb()
      const result = await reserveAssistantQuota(isolated, {
        ip: IP,
        now: new Date(iso),
      })
      expect(result).toBe('ok')
      const [row] = await isolated.select().from(aiUsageDaily)
      expect(row?.usageDate).toBe(usageDate)
    }
  })
})
