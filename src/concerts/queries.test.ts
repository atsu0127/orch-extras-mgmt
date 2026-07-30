import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, venues } from '../db/schema'
import { createTestDb } from '../test/db'
import { getConcertOverview, listConcertOptions } from './queries'

let db: Db

beforeEach(() => {
  db = createTestDb()
})

describe('listConcertOptions', () => {
  it('本番日の新しい順に並べ、未設定のものを末尾に回す', async () => {
    await db.insert(concerts).values([
      { id: 1, name: '未定', performanceDate: null },
      { id: 2, name: '古い', performanceDate: '2026-01-01' },
      { id: 3, name: '新しい', performanceDate: '2026-12-01' },
    ])

    const options = await listConcertOptions(db)

    expect(options.map((option) => option.id)).toEqual([3, 2, 1])
  })

  it('アーカイブ済みも含めて返す', async () => {
    await db.insert(concerts).values([
      { id: 1, name: '進行中', performanceDate: '2026-12-01' },
      {
        id: 2,
        name: '終了',
        performanceDate: '2026-01-01',
        status: 'archived',
      },
    ])

    const options = await listConcertOptions(db)

    expect(options.map((option) => option.status)).toEqual([
      'active',
      'archived',
    ])
  })
})

describe('getConcertOverview', () => {
  it('本番会場を一緒に返す', async () => {
    await db
      .insert(venues)
      .values({ id: 1, name: '市民ホール', address: '東京都1-1' })
    await db.insert(concerts).values({
      id: 1,
      name: '第10回定期演奏会',
      performanceDate: '2026-12-01',
      venueId: 1,
      attendanceUrl: 'https://example.com/attendance',
    })

    const overview = await getConcertOverview(db, 1)

    expect(overview).toMatchObject({
      name: '第10回定期演奏会',
      venueName: '市民ホール',
      venueAddress: '東京都1-1',
      attendanceUrl: 'https://example.com/attendance',
    })
  })

  it('複数行の備考を改行ごと返す', async () => {
    await db.insert(concerts).values({
      id: 1,
      name: '備考付き演奏会',
      note: '集合は13時です\n黒服を持参してください',
    })

    const overview = await getConcertOverview(db, 1)

    expect(overview?.note).toBe('集合は13時です\n黒服を持参してください')
  })

  it('会場が未設定でも取得できる', async () => {
    await db.insert(concerts).values({ id: 1, name: '会場未定の演奏会' })

    const overview = await getConcertOverview(db, 1)

    expect(overview?.venueName).toBeNull()
  })

  it('存在しない演奏会は null', async () => {
    await expect(getConcertOverview(db, 99)).resolves.toBeNull()
  })
})
