import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import {
  concerts,
  pieces,
  practiceMedia,
  practices,
  venues,
} from '../db/schema'
import { createTestDb } from '../test/db'
import {
  createConcert,
  deleteConcert,
  setConcertStatus,
  updateConcert,
} from './mutations'
import { listConcertsForAdmin } from './queries'

let db: Db

beforeEach(() => {
  db = createTestDb()
})

const input = {
  name: '第10回定期演奏会',
  performanceDate: '2026-09-24',
  venueId: null,
  attendanceUrl: null,
  attendanceNote: null,
}

describe('createConcert', () => {
  it('進行中として登録され、配下は空で始まる', async () => {
    await createConcert(db, input)

    expect(await listConcertsForAdmin(db)).toMatchObject([
      {
        name: '第10回定期演奏会',
        performanceDate: '2026-09-24',
        status: 'active',
        practiceCount: 0,
        pieceCount: 0,
      },
    ])
  })
})

describe('updateConcert', () => {
  it('出欠の回答先を後から設定できる', async () => {
    await db.insert(venues).values({ id: 1, name: 'A', address: 'a' })
    await createConcert(db, input)
    const [before] = await listConcertsForAdmin(db)
    if (!before) throw new Error('演奏会が登録できていない')

    await updateConcert(db, before.id, {
      ...input,
      venueId: 1,
      attendanceUrl: 'https://example.com/attendance',
      attendanceNote: '本番1か月前までに回答してください',
    })

    expect(await listConcertsForAdmin(db)).toMatchObject([
      {
        venueId: 1,
        attendanceUrl: 'https://example.com/attendance',
        attendanceNote: '本番1か月前までに回答してください',
      },
    ])
  })
})

describe('setConcertStatus', () => {
  it('アーカイブと進行中を往復できる', async () => {
    await createConcert(db, input)
    const [concert] = await listConcertsForAdmin(db)
    if (!concert) throw new Error('演奏会が登録できていない')

    await setConcertStatus(db, concert.id, 'archived')
    expect((await listConcertsForAdmin(db))[0]?.status).toBe('archived')

    await setConcertStatus(db, concert.id, 'active')
    expect((await listConcertsForAdmin(db))[0]?.status).toBe('active')
  })
})

describe('deleteConcert', () => {
  beforeEach(async () => {
    await db.insert(concerts).values([
      { id: 1, name: '消す方' },
      { id: 2, name: '残す方' },
    ])
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: '2026-08-01' },
      { id: 2, concertId: 2, date: '2026-08-02' },
    ])
    await db.insert(practiceMedia).values([
      { id: 1, practiceId: 1, title: '1楽章', url: 'https://example.com/1' },
      { id: 2, practiceId: 2, title: '2楽章', url: 'https://example.com/2' },
    ])
    await db.insert(pieces).values([
      { id: 1, concertId: 1, title: '曲A' },
      { id: 2, concertId: 2, title: '曲B' },
    ])
  })

  it('配下の練習・録音リンク・曲も消える', async () => {
    await deleteConcert(db, 1)

    expect(await db.select().from(concerts)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(practices)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(practiceMedia)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(pieces)).toMatchObject([{ id: 2 }])
  })

  it('一覧では消える件数が分かる', async () => {
    await db.insert(pieces).values({ id: 3, concertId: 1, title: '曲C' })

    const items = await listConcertsForAdmin(db)
    expect(items.find(({ id }) => id === 1)).toMatchObject({
      practiceCount: 1,
      pieceCount: 2,
    })
    expect(items.find(({ id }) => id === 2)).toMatchObject({
      practiceCount: 1,
      pieceCount: 1,
    })
  })
})
