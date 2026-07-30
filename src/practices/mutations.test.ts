import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, practiceMedia, practices, venues } from '../db/schema'
import { createTestDb } from '../test/db'
import {
  createPractice,
  createPracticeMedia,
  deletePractice,
  deletePracticeMedia,
  movePracticeMedia,
  updatePractice,
} from './mutations'
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

describe('練習の録音リンク', () => {
  beforeEach(async () => {
    await db.insert(practices).values([
      { id: 1, concertId: 1, date: '2026-08-01' },
      { id: 2, concertId: 1, date: '2026-08-08' },
    ])
  })

  /** 対象の練習に付いているリンクを、表示と同じ並びで取り出す */
  async function titles(practiceId = 1): Promise<Array<string>> {
    const items = await listPracticesForAdmin(db, 1)
    const practice = items.find(({ id }) => id === practiceId)
    return (practice?.media ?? []).map(({ title }) => title)
  }

  it('追加した順に並ぶ', async () => {
    await createPracticeMedia(db, 1, {
      title: '1楽章',
      url: 'https://example.com/1',
    })
    await createPracticeMedia(db, 1, {
      title: '2楽章',
      url: 'https://example.com/2',
    })

    expect(await titles()).toEqual(['1楽章', '2楽章'])
  })

  it('並びは練習ごとに独立している', async () => {
    await createPracticeMedia(db, 1, {
      title: '1楽章',
      url: 'https://example.com/1',
    })
    await createPracticeMedia(db, 2, {
      title: '別の練習の録音',
      url: 'https://example.com/2',
    })

    expect(await titles(1)).toEqual(['1楽章'])
    expect(await titles(2)).toEqual(['別の練習の録音'])
  })

  it('上下に動かすと並びが変わる', async () => {
    for (const title of ['1楽章', '2楽章', '3楽章']) {
      await createPracticeMedia(db, 1, {
        title,
        url: `https://example.com/${title}`,
      })
    }
    const [first, , third] =
      (await listPracticesForAdmin(db, 1))[0]?.media ?? []
    if (!first || !third) throw new Error('録音リンクが登録できていない')

    await movePracticeMedia(db, third.id, 'up')
    expect(await titles()).toEqual(['1楽章', '3楽章', '2楽章'])

    await movePracticeMedia(db, first.id, 'down')
    expect(await titles()).toEqual(['3楽章', '1楽章', '2楽章'])
  })

  it('端を越えては動かせない', async () => {
    await createPracticeMedia(db, 1, {
      title: '1楽章',
      url: 'https://example.com/1',
    })
    await createPracticeMedia(db, 1, {
      title: '2楽章',
      url: 'https://example.com/2',
    })
    const [first] = (await listPracticesForAdmin(db, 1))[0]?.media ?? []
    if (!first) throw new Error('録音リンクが登録できていない')

    await movePracticeMedia(db, first.id, 'up')

    expect(await titles()).toEqual(['1楽章', '2楽章'])
  })

  it('消しても残りの並びは崩れない', async () => {
    for (const title of ['1楽章', '2楽章', '3楽章']) {
      await createPracticeMedia(db, 1, {
        title,
        url: `https://example.com/${title}`,
      })
    }
    const [, second] = (await listPracticesForAdmin(db, 1))[0]?.media ?? []
    if (!second) throw new Error('録音リンクが登録できていない')

    await deletePracticeMedia(db, second.id)

    expect(await titles()).toEqual(['1楽章', '3楽章'])
  })
})
