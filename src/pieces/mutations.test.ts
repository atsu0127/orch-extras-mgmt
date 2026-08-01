import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts, linkChecks } from '../db/schema'
import { createTestDb } from '../test/db'
import { createPiece, deletePiece, movePiece, updatePiece } from './mutations'
import { listPiecesForConcert } from './queries'

let db: Db

beforeEach(async () => {
  db = createTestDb()
  await db.insert(concerts).values([
    { id: 1, name: '第10回定期演奏会' },
    { id: 2, name: '第11回定期演奏会' },
  ])
})

const fields = {
  title: '交響曲第5番',
  composer: 'ベートーヴェン',
  bowingUrl: null,
  scoreWithoutBowingUrl: null,
}

/** 演奏順に並んだ曲名 */
async function titles(concertId = 1): Promise<Array<string>> {
  const items = await listPiecesForConcert(db, concertId)
  return items.map(({ title }) => title)
}

describe('createPiece', () => {
  it('登録した順に並び、指定した演奏会にだけ入る', async () => {
    await createPiece(db, 1, fields)
    await createPiece(db, 1, { ...fields, title: '序曲' })
    await createPiece(db, 2, { ...fields, title: '別の演奏会の曲' })

    expect(await titles(1)).toEqual(['交響曲第5番', '序曲'])
    expect(await titles(2)).toEqual(['別の演奏会の曲'])
  })
})

describe('updatePiece', () => {
  it('ボウイングURLを後から設定できる', async () => {
    await createPiece(db, 1, fields)
    const [piece] = await listPiecesForConcert(db, 1)
    if (!piece) throw new Error('曲が登録できていない')

    await updatePiece(db, piece.id, {
      ...fields,
      bowingUrl: 'https://example.com/bowing',
    })

    expect(await listPiecesForConcert(db, 1)).toMatchObject([
      { bowingUrl: 'https://example.com/bowing' },
    ])
  })

  it('ボウイングなしの楽譜URLをあり側と独立に設定できる', async () => {
    await createPiece(db, 1, fields)
    const [piece] = await listPiecesForConcert(db, 1)
    if (!piece) throw new Error('曲が登録できていない')

    await updatePiece(db, piece.id, {
      ...fields,
      bowingUrl: 'https://example.com/with-bowing',
      scoreWithoutBowingUrl: 'https://example.com/without-bowing',
    })

    expect(await listPiecesForConcert(db, 1)).toMatchObject([
      {
        bowingUrl: 'https://example.com/with-bowing',
        scoreWithoutBowingUrl: 'https://example.com/without-bowing',
      },
    ])

    await updatePiece(db, piece.id, {
      ...fields,
      bowingUrl: 'https://example.com/with-bowing',
      scoreWithoutBowingUrl: null,
    })

    expect(await listPiecesForConcert(db, 1)).toMatchObject([
      {
        bowingUrl: 'https://example.com/with-bowing',
        scoreWithoutBowingUrl: null,
      },
    ])
  })

  it('URL を差し替えると前の検知結果を捨てる', async () => {
    await createPiece(db, 1, {
      ...fields,
      bowingUrl: 'https://example.com/old',
    })
    const [piece] = await listPiecesForConcert(db, 1)
    if (!piece) throw new Error('曲が登録できていない')
    await db.insert(linkChecks).values({
      targetType: 'bowing',
      targetId: piece.id,
      url: 'https://example.com/old',
      verdict: 'broken',
    })

    await updatePiece(db, piece.id, {
      ...fields,
      bowingUrl: 'https://example.com/new',
    })

    expect(await db.select().from(linkChecks)).toEqual([])
  })

  it('URL が同じままなら検知結果を残す', async () => {
    await createPiece(db, 1, {
      ...fields,
      bowingUrl: 'https://example.com/bowing',
    })
    const [piece] = await listPiecesForConcert(db, 1)
    if (!piece) throw new Error('曲が登録できていない')
    await db.insert(linkChecks).values({
      targetType: 'bowing',
      targetId: piece.id,
      url: 'https://example.com/bowing',
      verdict: 'ok',
    })

    await updatePiece(db, piece.id, {
      ...fields,
      title: '交響曲第5番 ハ短調',
      bowingUrl: 'https://example.com/bowing',
    })

    expect(await db.select().from(linkChecks)).toMatchObject([
      { verdict: 'ok' },
    ])
  })

  it('URL を空にしたら検知結果を捨てる', async () => {
    await createPiece(db, 1, {
      ...fields,
      bowingUrl: 'https://example.com/bowing',
    })
    const [piece] = await listPiecesForConcert(db, 1)
    if (!piece) throw new Error('曲が登録できていない')
    await db.insert(linkChecks).values({
      targetType: 'bowing',
      targetId: piece.id,
      url: 'https://example.com/bowing',
      verdict: 'ok',
    })

    await updatePiece(db, piece.id, { ...fields, bowingUrl: null })

    expect(await db.select().from(linkChecks)).toEqual([])
  })
})

describe('movePiece', () => {
  beforeEach(async () => {
    for (const title of ['1曲目', '2曲目', '3曲目']) {
      await createPiece(db, 1, { ...fields, title })
    }
  })

  it('演奏順を上下に入れ替えられる', async () => {
    const [first, , third] = await listPiecesForConcert(db, 1)
    if (!first || !third) throw new Error('曲が登録できていない')

    await movePiece(db, third.id, 'up')
    expect(await titles()).toEqual(['1曲目', '3曲目', '2曲目'])

    await movePiece(db, first.id, 'down')
    expect(await titles()).toEqual(['3曲目', '1曲目', '2曲目'])
  })

  it('別の演奏会の曲は巻き込まない', async () => {
    await createPiece(db, 2, { ...fields, title: '別の演奏会の曲' })
    const [first] = await listPiecesForConcert(db, 1)
    if (!first) throw new Error('曲が登録できていない')

    await movePiece(db, first.id, 'down')

    expect(await titles(2)).toEqual(['別の演奏会の曲'])
  })
})

describe('deletePiece', () => {
  it('消した曲だけがいなくなる', async () => {
    await createPiece(db, 1, { ...fields, title: '1曲目' })
    await createPiece(db, 1, { ...fields, title: '2曲目' })
    const [first] = await listPiecesForConcert(db, 1)
    if (!first) throw new Error('曲が登録できていない')

    await deletePiece(db, first.id)

    expect(await titles()).toEqual(['2曲目'])
  })
})
