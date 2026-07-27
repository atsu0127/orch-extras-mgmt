import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, practiceMedia, practices, venues } from '../db/schema'
import { createTestDb } from '../test/db'
import { createPractice, deletePractice, updatePractice } from './mutations'
import { listPracticesForAdmin } from './queries'

let db: Db

beforeEach(async () => {
  db = createTestDb()
  await db.insert(concerts).values([
    { id: 1, name: '第10回定期演奏会' },
    { id: 2, name: '第11回定期演奏会' },
  ])
  await db.insert(venues).values({ id: 1, name: '市民会館', address: 'a' })
})

const fields = {
  date: '2026-08-01',
  startTime: '19:00',
  endTime: '21:00',
  venueId: null,
  detail: null,
}

describe('createPractice', () => {
  it('指定した演奏会にだけ入る', async () => {
    await createPractice(db, 1, fields)

    expect(await listPracticesForAdmin(db, 1)).toMatchObject([
      { date: '2026-08-01', startTime: '19:00', endTime: '21:00' },
    ])
    expect(await listPracticesForAdmin(db, 2)).toEqual([])
  })

  it('日付順に並ぶ。同じ日は開始時刻の早い方が先', async () => {
    await createPractice(db, 1, { ...fields, date: '2026-08-10' })
    await createPractice(db, 1, { ...fields, date: '2026-08-01' })
    await createPractice(db, 1, {
      ...fields,
      date: '2026-08-01',
      startTime: '13:00',
      endTime: '15:00',
    })

    expect(await listPracticesForAdmin(db, 1)).toMatchObject([
      { date: '2026-08-01', startTime: '13:00' },
      { date: '2026-08-01', startTime: '19:00' },
      { date: '2026-08-10' },
    ])
  })
})

describe('updatePractice', () => {
  it('会場と詳細を後から足せる', async () => {
    await createPractice(db, 1, fields)
    const [before] = await listPracticesForAdmin(db, 1)
    if (!before) throw new Error('練習が登録できていない')

    await updatePractice(db, before.id, {
      ...fields,
      venueId: 1,
      detail: '弦分奏。譜面台は各自持参',
    })

    expect(await listPracticesForAdmin(db, 1)).toMatchObject([
      { venueId: 1, detail: '弦分奏。譜面台は各自持参' },
    ])
  })

  it('時刻を消して未定に戻せる', async () => {
    await createPractice(db, 1, fields)
    const [before] = await listPracticesForAdmin(db, 1)
    if (!before) throw new Error('練習が登録できていない')

    await updatePractice(db, before.id, {
      ...fields,
      startTime: null,
      endTime: null,
    })

    expect(await listPracticesForAdmin(db, 1)).toMatchObject([
      { startTime: null, endTime: null },
    ])
  })
})

describe('deletePractice', () => {
  it('付いている録音リンクも消え、他の練習は残る', async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: '2026-08-01' },
      { id: 2, concertId: 1, date: '2026-08-08' },
    ])
    await db.insert(practiceMedia).values([
      { id: 1, practiceId: 1, title: '1楽章', url: 'https://example.com/1' },
      { id: 2, practiceId: 2, title: '2楽章', url: 'https://example.com/2' },
    ])

    await deletePractice(db, 1)

    expect(await listPracticesForAdmin(db, 1)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(practiceMedia)).toMatchObject([{ id: 2 }])
  })
})
