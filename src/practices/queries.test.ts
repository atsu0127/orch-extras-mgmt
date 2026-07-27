import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, practiceMedia, practices, venues } from '../db/schema'
import { createTestDb } from '../test/db'
import { getNextPractice, listPracticesWithMedia } from './queries'

const TODAY = '2026-07-27'

let db: Db

beforeEach(async () => {
  db = createTestDb()
  await db.insert(concerts).values([
    { id: 1, name: '第10回定期演奏会' },
    { id: 2, name: '別の演奏会' },
  ])
  await db
    .insert(venues)
    .values({ id: 1, name: '市民会館', address: '東京都1-1', note: '駅前' })
})

describe('getNextPractice', () => {
  it('今日以降で最も早い1件を返す', async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: '2026-07-20' },
      { id: 2, concertId: 1, date: '2026-08-10' },
      { id: 3, concertId: 1, date: '2026-07-28' },
    ])

    const next = await getNextPractice(db, 1, TODAY)

    expect(next?.id).toBe(3)
  })

  it('今日の練習は今後として扱う', async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: TODAY },
      { id: 2, concertId: 1, date: '2026-07-28' },
    ])

    const next = await getNextPractice(db, 1, TODAY)

    expect(next?.id).toBe(1)
  })

  it('同じ日なら開始時刻の早い方を返す', async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: '2026-07-28', startTime: '18:30' },
      { id: 2, concertId: 1, date: '2026-07-28', startTime: '13:00' },
    ])

    const next = await getNextPractice(db, 1, TODAY)

    expect(next?.id).toBe(2)
  })

  it('他の演奏会の練習は混ざらない', async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 2, date: '2026-07-28' },
      { id: 2, concertId: 1, date: '2026-08-10' },
    ])

    const next = await getNextPractice(db, 1, TODAY)

    expect(next?.id).toBe(2)
  })

  it('今後の練習が無ければ null', async () => {
    await db
      .insert(practices)
      .values({ id: 1, concertId: 1, date: '2026-07-26' })

    await expect(getNextPractice(db, 1, TODAY)).resolves.toBeNull()
  })

  it('会場と録音を一緒に返す', async () => {
    await db
      .insert(practices)
      .values({ id: 1, concertId: 1, date: '2026-07-28', venueId: 1 })
    await db.insert(practiceMedia).values({
      id: 1,
      practiceId: 1,
      title: '1楽章',
      url: 'https://example.com/1',
    })

    const next = await getNextPractice(db, 1, TODAY)

    expect(next?.venue).toEqual({
      name: '市民会館',
      address: '東京都1-1',
      note: '駅前',
    })
    expect(next?.media).toEqual([
      { id: 1, title: '1楽章', url: 'https://example.com/1' },
    ])
  })
})

describe('listPracticesWithMedia', () => {
  it('日付の昇順、同日は開始時刻の昇順で返す', async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: '2026-08-10' },
      { id: 2, concertId: 1, date: '2026-07-20', startTime: '18:00' },
      { id: 3, concertId: 1, date: '2026-07-20', startTime: '10:00' },
    ])

    const list = await listPracticesWithMedia(db, 1)

    expect(list.map((practice) => practice.id)).toEqual([3, 2, 1])
  })

  it('録音を練習ごとに束ね、sort_order の順に並べる', async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: '2026-07-20' },
      { id: 2, concertId: 1, date: '2026-07-21' },
    ])
    await db.insert(practiceMedia).values([
      {
        id: 1,
        practiceId: 1,
        title: '2番目',
        url: 'https://example.com/2',
        sortOrder: 1,
      },
      {
        id: 2,
        practiceId: 1,
        title: '1番目',
        url: 'https://example.com/1',
        sortOrder: 0,
      },
      {
        id: 3,
        practiceId: 2,
        title: '別の練習',
        url: 'https://example.com/3',
      },
    ])

    const list = await listPracticesWithMedia(db, 1)

    expect(list[0]?.media.map((link) => link.title)).toEqual(['1番目', '2番目'])
    expect(list[1]?.media.map((link) => link.title)).toEqual(['別の練習'])
  })

  it('会場が削除された練習は会場なしとして残る', async () => {
    await db
      .insert(practices)
      .values({ id: 1, concertId: 1, date: '2026-07-20', venueId: null })

    const list = await listPracticesWithMedia(db, 1)

    expect(list[0]?.venue).toBeNull()
  })

  it('練習が無ければ空配列', async () => {
    await expect(listPracticesWithMedia(db, 1)).resolves.toEqual([])
  })
})
