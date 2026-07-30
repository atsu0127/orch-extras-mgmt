import { beforeEach, describe, expect, it } from 'vitest'
import { createConcertResource } from '../concert-resources/mutations'
import type { Db } from '../db/client'
import {
  concertResources,
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
  note: '集合は開演90分前です',
}

describe('createConcert', () => {
  it('進行中として登録され、配下は空で始まる', async () => {
    await createConcert(db, input)

    expect(await listConcertsForAdmin(db)).toMatchObject([
      {
        name: '第10回定期演奏会',
        performanceDate: '2026-09-24',
        note: '集合は開演90分前です',
        status: 'active',
        practiceCount: 0,
        pieceCount: 0,
        resourceCount: 0,
        resources: [],
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
      note: '黒服を持参してください',
    })

    expect(await listConcertsForAdmin(db)).toMatchObject([
      {
        venueId: 1,
        attendanceUrl: 'https://example.com/attendance',
        attendanceNote: '本番1か月前までに回答してください',
        note: '黒服を持参してください',
      },
    ])
  })

  it('備考入力をまだ持たない呼び出しでは既存の備考を消さない', async () => {
    await createConcert(db, input)
    const [concert] = await listConcertsForAdmin(db)
    if (!concert) throw new Error('演奏会が登録できていない')
    const { note: _note, ...inputWithoutNote } = input

    await updateConcert(db, concert.id, {
      ...inputWithoutNote,
      name: '演奏会名だけ変更',
    })

    expect((await listConcertsForAdmin(db))[0]).toMatchObject({
      name: '演奏会名だけ変更',
      note: '集合は開演90分前です',
    })
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
    await db.insert(concertResources).values([
      {
        id: 1,
        concertId: 1,
        title: '消える資料',
        url: 'https://example.com/delete',
      },
      {
        id: 2,
        concertId: 2,
        title: '残る資料',
        url: 'https://example.com/keep',
      },
    ])
  })

  it('配下の練習・録音リンク・曲・資料も消える', async () => {
    await deleteConcert(db, 1)

    expect(await db.select().from(concerts)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(practices)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(practiceMedia)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(pieces)).toMatchObject([{ id: 2 }])
    expect(await db.select().from(concertResources)).toMatchObject([{ id: 2 }])
  })

  it('一覧では消える件数が分かる', async () => {
    await db.insert(pieces).values({ id: 3, concertId: 1, title: '曲C' })
    await createConcertResource(db, 1, {
      title: '追加資料',
      url: 'https://example.com/additional',
    })

    const items = await listConcertsForAdmin(db)
    expect(items.find(({ id }) => id === 1)).toMatchObject({
      practiceCount: 1,
      pieceCount: 2,
      resourceCount: 2,
      resources: [{ title: '消える資料' }, { title: '追加資料' }],
    })
    expect(items.find(({ id }) => id === 2)).toMatchObject({
      practiceCount: 1,
      pieceCount: 1,
      resourceCount: 1,
      resources: [{ title: '残る資料' }],
    })
  })
})
