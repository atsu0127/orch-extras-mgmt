import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { concerts } from '../db/schema'
import {
  CONCERT_RESOURCE_LIMIT_MESSAGE,
  MAX_CONCERT_RESOURCES,
} from '../lib/limits'
import { createTestDb } from '../test/db'
import {
  createConcertResource,
  deleteConcertResource,
  moveConcertResource,
  updateConcertResource,
} from './mutations'
import { listConcertResources, listConcertResourcesByConcert } from './queries'

let db: Db

beforeEach(async () => {
  db = createTestDb()
  await db.insert(concerts).values([
    { id: 1, name: '第10回定期演奏会' },
    { id: 2, name: '第11回定期演奏会' },
  ])
})

async function titles(concertId = 1): Promise<Array<string>> {
  return (await listConcertResources(db, concertId)).map(({ title }) => title)
}

describe('createConcertResource', () => {
  it('登録順に並び、6件目を拒否する', async () => {
    for (let index = 1; index <= MAX_CONCERT_RESOURCES; index += 1) {
      await createConcertResource(db, 1, {
        title: `資料${index}`,
        url: `https://example.com/${index}`,
      })
    }

    await expect(
      createConcertResource(db, 1, {
        title: '資料6',
        url: 'https://example.com/6',
      }),
    ).rejects.toThrow(CONCERT_RESOURCE_LIMIT_MESSAGE)
    expect(await titles()).toEqual([
      '資料1',
      '資料2',
      '資料3',
      '資料4',
      '資料5',
    ])
  })

  it('4件から2件を同時追加しても一方だけ成功する', async () => {
    for (let index = 1; index <= 4; index += 1) {
      await createConcertResource(db, 1, {
        title: `資料${index}`,
        url: `https://example.com/${index}`,
      })
    }

    const results = await Promise.allSettled([
      createConcertResource(db, 1, {
        title: '同時追加A',
        url: 'https://example.com/a',
      }),
      createConcertResource(db, 1, {
        title: '同時追加B',
        url: 'https://example.com/b',
      }),
    ])

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    )
    const rejected = results.find(({ status }) => status === 'rejected')
    if (rejected?.status !== 'rejected') {
      throw new Error('上限超過が拒否されていない')
    }
    expect(rejected.reason).toEqual(new Error(CONCERT_RESOURCE_LIMIT_MESSAGE))
    const resources = await listConcertResources(db, 1)
    expect(resources).toHaveLength(MAX_CONCERT_RESOURCES)
    expect(resources.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2, 3, 4])
  })

  it('複数演奏会の資料を演奏会ごとにまとめる', async () => {
    await createConcertResource(db, 1, {
      title: '資料A',
      url: 'https://example.com/a',
    })
    await createConcertResource(db, 2, {
      title: '資料B',
      url: 'https://example.com/b',
    })

    const grouped = await listConcertResourcesByConcert(db, [1, 2, 3])

    expect(grouped.get(1)?.map(({ title }) => title)).toEqual(['資料A'])
    expect(grouped.get(2)?.map(({ title }) => title)).toEqual(['資料B'])
    expect(grouped.get(3)).toBeUndefined()
  })

  it('101個以上の演奏会IDでもバインド上限を超えない', async () => {
    let queryCount = 0
    const limitedDb = createTestDb({
      maxBindParameters: 100,
      onQuery: () => {
        queryCount += 1
      },
    })
    await limitedDb
      .insert(concerts)
      .values({ id: 1, name: 'バインド上限の境界テスト' })
    await createConcertResource(limitedDb, 1, {
      title: '取得できる資料',
      url: 'https://example.com/resource',
    })
    const concertIds = Array.from({ length: 101 }, (_, index) => index + 1)
    queryCount = 0

    const grouped = await listConcertResourcesByConcert(limitedDb, concertIds)

    expect(queryCount).toBe(1)
    expect(grouped.get(1)?.map(({ title }) => title)).toEqual([
      '取得できる資料',
    ])
  })

  it('空の演奏会IDではDBへ問い合わせない', async () => {
    let queryCount = 0
    const trackedDb = createTestDb({
      onQuery: () => {
        queryCount += 1
      },
    })

    await expect(listConcertResourcesByConcert(trackedDb, [])).resolves.toEqual(
      new Map(),
    )
    expect(queryCount).toBe(0)
  })
})

describe('updateConcertResource', () => {
  it('タイトルとURLを編集できる', async () => {
    await createConcertResource(db, 1, {
      title: '編集前',
      url: 'https://example.com/before',
    })
    const [resource] = await listConcertResources(db, 1)
    if (!resource) throw new Error('資料が登録できていない')

    await updateConcertResource(db, resource.id, {
      title: '編集後',
      url: 'https://example.com/after',
    })

    expect(await listConcertResources(db, 1)).toMatchObject([
      {
        concertId: 1,
        title: '編集後',
        url: 'https://example.com/after',
        sortOrder: 0,
      },
    ])
  })
})

describe('moveConcertResource', () => {
  beforeEach(async () => {
    for (const title of ['資料1', '資料2', '資料3']) {
      await createConcertResource(db, 1, {
        title,
        url: `https://example.com/${title}`,
      })
    }
    await createConcertResource(db, 2, {
      title: '別の演奏会の資料',
      url: 'https://example.com/other',
    })
  })

  it('上下へ移動できる', async () => {
    const [first, , third] = await listConcertResources(db, 1)
    if (!first || !third) throw new Error('資料が登録できていない')

    await moveConcertResource(db, third.id, 'up')
    expect(await titles()).toEqual(['資料1', '資料3', '資料2'])

    await moveConcertResource(db, first.id, 'down')
    expect(await titles()).toEqual(['資料3', '資料1', '資料2'])
  })

  it('別の演奏会の資料を巻き込まない', async () => {
    const [first] = await listConcertResources(db, 1)
    if (!first) throw new Error('資料が登録できていない')

    await moveConcertResource(db, first.id, 'down')

    expect(await titles(2)).toEqual(['別の演奏会の資料'])
  })
})

describe('deleteConcertResource', () => {
  it('指定した資料だけを削除する', async () => {
    for (const title of ['残す資料', '消す資料']) {
      await createConcertResource(db, 1, {
        title,
        url: `https://example.com/${title}`,
      })
    }
    const [target] = await listConcertResources(db, 1)
    if (!target) throw new Error('資料が登録できていない')

    await deleteConcertResource(db, target.id)

    expect(await listConcertResources(db, 1)).toMatchObject([
      { title: '消す資料', sortOrder: 0 },
    ])
  })
})
