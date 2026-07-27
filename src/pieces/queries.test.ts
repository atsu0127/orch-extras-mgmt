import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, pieces } from '../db/schema'
import { createTestDb } from '../test/db'
import { listPiecesForConcert } from './queries'

let db: Db

beforeEach(async () => {
  db = createTestDb()
  await db.insert(concerts).values([
    { id: 1, name: '第10回定期演奏会' },
    { id: 2, name: '別の演奏会' },
  ])
})

describe('listPiecesForConcert', () => {
  it('演奏順に並べる', async () => {
    await db.insert(pieces).values([
      { id: 1, concertId: 1, title: '3曲目', sortOrder: 2 },
      { id: 2, concertId: 1, title: '1曲目', sortOrder: 0 },
      { id: 3, concertId: 1, title: '2曲目', sortOrder: 1 },
    ])

    const list = await listPiecesForConcert(db, 1)

    expect(list.map(({ title }) => title)).toEqual(['1曲目', '2曲目', '3曲目'])
  })

  it('演奏順が同じなら登録順で決める', async () => {
    await db.insert(pieces).values([
      { id: 1, concertId: 1, title: '先', sortOrder: 0 },
      { id: 2, concertId: 1, title: '後', sortOrder: 0 },
    ])

    const list = await listPiecesForConcert(db, 1)

    expect(list.map(({ title }) => title)).toEqual(['先', '後'])
  })

  it('ボウイングが未設定の曲も返す', async () => {
    await db.insert(pieces).values([
      {
        id: 1,
        concertId: 1,
        title: '設定あり',
        bowingUrl: 'https://example.com/bowing',
      },
      { id: 2, concertId: 1, title: '設定なし' },
    ])

    const list = await listPiecesForConcert(db, 1)

    expect(list.map(({ bowingUrl }) => bowingUrl)).toEqual([
      'https://example.com/bowing',
      null,
    ])
  })

  it('他の演奏会の曲は混ざらない', async () => {
    await db.insert(pieces).values([
      { id: 1, concertId: 2, title: '別の演奏会の曲' },
      { id: 2, concertId: 1, title: 'この演奏会の曲' },
    ])

    const list = await listPiecesForConcert(db, 1)

    expect(list.map(({ title }) => title)).toEqual(['この演奏会の曲'])
  })
})
