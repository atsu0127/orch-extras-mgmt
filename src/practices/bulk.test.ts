import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, venues } from '../db/schema'
import {
  BULK_PRACTICE_LIMIT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE,
  MAX_BULK_PRACTICES,
} from '../lib/limits'
import { createTestDb } from '../test/db'
import { listVenues } from '../venues/queries'
import { createPracticesBulk } from './bulk'
import { bulkPracticesInput } from './bulk-input'
import { listPracticesForAdmin } from './queries'

let db: Db

beforeEach(async () => {
  db = createTestDb()
  await db.insert(concerts).values([
    { id: 1, name: '第10回定期演奏会' },
    { id: 2, name: '第11回定期演奏会' },
  ])
  await db.insert(venues).values({
    id: 1,
    name: '市民会館',
    address: '東京都1-1',
  })
})

const baseRow = {
  date: '2026-08-01',
  startTime: '19:00' as string | null,
  endTime: '21:00' as string | null,
  detail: null as string | null,
  venueId: null as number | null,
}

describe('bulkPracticesInput', () => {
  it(`${MAX_BULK_PRACTICES}件超は拒否する`, () => {
    const rows = Array.from({ length: MAX_BULK_PRACTICES + 1 }, (_, index) => ({
      ...baseRow,
      date: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
    }))

    const result = bulkPracticesInput.safeParse({ concertId: 1, rows })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(
      result.error.issues.some(
        (issue) => issue.message === BULK_PRACTICE_LIMIT_MESSAGE,
      ),
    ).toBe(true)
  })
})

describe('createPracticesBulk', () => {
  it('複数行を指定した演奏会にだけ追加する', async () => {
    const result = await createPracticesBulk(db, 1, [
      { ...baseRow, date: '2026-08-01', detail: '合奏' },
      {
        ...baseRow,
        date: '2026-08-08',
        venueId: 1,
        detail: '分奏',
      },
    ])

    expect(result).toEqual({ practiceCount: 2 })
    expect(await listPracticesForAdmin(db, 1)).toMatchObject([
      { date: '2026-08-01', detail: '合奏', venueId: null },
      { date: '2026-08-08', detail: '分奏', venueId: 1 },
    ])
    expect(await listPracticesForAdmin(db, 2)).toEqual([])
  })

  it('一括では会場を新規作成しない', async () => {
    await createPracticesBulk(db, 1, [
      { ...baseRow, date: '2026-08-01', venueId: 1 },
      { ...baseRow, date: '2026-08-08', venueId: null },
    ])

    expect(await listVenues(db)).toHaveLength(1)
  })

  it('存在しない会場IDは拒否する', async () => {
    await expect(
      createPracticesBulk(db, 1, [{ ...baseRow, venueId: 999 }]),
    ).rejects.toThrow(BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE)
  })

  it('存在しない演奏会は拒否する', async () => {
    await expect(createPracticesBulk(db, 999, [baseRow])).rejects.toThrow(
      BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
    )
  })

  it('行数に比例してクエリを増やさない', async () => {
    let queries = 0
    db = createTestDb({
      onQuery: () => {
        queries += 1
      },
    })
    await db.insert(concerts).values({ id: 1, name: '第10回定期演奏会' })
    await db.insert(venues).values({
      id: 1,
      name: '市民会館',
      address: '東京都1-1',
    })

    const rows = Array.from({ length: 10 }, (_, index) => ({
      ...baseRow,
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      venueId: index % 2 === 0 ? 1 : null,
    }))

    await createPracticesBulk(db, 1, rows)

    // 演奏会確認・会場確認・練習 INSERT
    expect(queries).toBeLessThanOrEqual(5)
    expect(await listPracticesForAdmin(db, 1)).toHaveLength(10)
  })
})
