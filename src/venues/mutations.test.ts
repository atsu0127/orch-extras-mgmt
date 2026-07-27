import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, practices, venues } from '../db/schema'
import { createTestDb } from '../test/db'
import { createVenue, deleteVenue, updateVenue } from './mutations'
import { listVenues } from './queries'

let db: Db

beforeEach(() => {
  db = createTestDb()
})

describe('createVenue', () => {
  it('登録した会場が一覧に出る', async () => {
    await createVenue(db, {
      name: '市民会館 大練習室',
      address: '東京都1-1',
      note: null,
    })

    const [venue] = await listVenues(db)
    expect(venue).toMatchObject({
      name: '市民会館 大練習室',
      address: '東京都1-1',
      note: null,
      practiceCount: 0,
      concertCount: 0,
    })
  })
})

describe('updateVenue', () => {
  it('指定した会場だけを書き換える', async () => {
    await createVenue(db, { name: 'A', address: 'a', note: 'メモ' })
    await createVenue(db, { name: 'B', address: 'b', note: null })
    const before = await listVenues(db)
    const target = before[0]
    if (!target) throw new Error('会場が登録できていない')

    await updateVenue(db, target.id, {
      name: 'A 改',
      address: 'a 改',
      note: null,
    })

    const after = await listVenues(db)
    expect(after).toMatchObject([
      { name: 'A 改', address: 'a 改', note: null },
      { name: 'B', address: 'b', note: null },
    ])
  })
})

describe('deleteVenue', () => {
  beforeEach(async () => {
    await db.insert(venues).values({ id: 1, name: 'A', address: 'a' })
    await db
      .insert(concerts)
      .values({ id: 1, name: '第1回定期演奏会', venueId: 1 })
    await db
      .insert(practices)
      .values({ id: 1, concertId: 1, date: '2026-08-01', venueId: 1 })
  })

  it('使用中の会場を削除しても練習と演奏会は残り、会場が未設定になる', async () => {
    await deleteVenue(db, 1)

    const [practice] = await db
      .select()
      .from(practices)
      .where(eq(practices.id, 1))
    const [concert] = await db.select().from(concerts).where(eq(concerts.id, 1))

    expect(practice?.date).toBe('2026-08-01')
    expect(practice?.venueId).toBeNull()
    expect(concert?.name).toBe('第1回定期演奏会')
    expect(concert?.venueId).toBeNull()
  })

  it('一覧では会場ごとの使用件数が分かる', async () => {
    await db.insert(venues).values({ id: 2, name: 'B', address: 'b' })
    await db
      .insert(practices)
      .values({ id: 2, concertId: 1, date: '2026-08-08', venueId: 1 })

    expect(await listVenues(db)).toMatchObject([
      { name: 'A', practiceCount: 2, concertCount: 1 },
      { name: 'B', practiceCount: 0, concertCount: 0 },
    ])
  })
})
