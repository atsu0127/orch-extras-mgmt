import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { announcements, concerts } from '../db/schema'
import { ANNOUNCEMENT_LIMIT_MESSAGE, MAX_ANNOUNCEMENTS } from '../lib/limits'
import { createTestDb } from '../test/db'
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from './mutations'
import { listAnnouncementsForConcert } from './queries'

let db: Db

beforeEach(async () => {
  db = createTestDb()
  await db.insert(concerts).values([
    { id: 1, name: '第10回定期演奏会' },
    { id: 2, name: '第11回定期演奏会' },
  ])
})

async function titles(concertId = 1): Promise<Array<string>> {
  return (await listAnnouncementsForConcert(db, concertId)).map(
    ({ title }) => title,
  )
}

describe('createAnnouncement', () => {
  it('新しい順に並び、11件目を拒否する', async () => {
    for (let index = 1; index <= MAX_ANNOUNCEMENTS; index += 1) {
      await createAnnouncement(db, 1, {
        title: `お知らせ${index}`,
        body: `本文${index}`,
        url: null,
      })
    }

    await expect(
      createAnnouncement(db, 1, {
        title: 'お知らせ11',
        body: '本文11',
        url: null,
      }),
    ).rejects.toThrow(ANNOUNCEMENT_LIMIT_MESSAGE)
    expect(await titles()).toEqual([
      'お知らせ10',
      'お知らせ9',
      'お知らせ8',
      'お知らせ7',
      'お知らせ6',
      'お知らせ5',
      'お知らせ4',
      'お知らせ3',
      'お知らせ2',
      'お知らせ1',
    ])
  })

  it('9件から2件を同時追加しても一方だけ成功する', async () => {
    for (let index = 1; index <= 9; index += 1) {
      await createAnnouncement(db, 1, {
        title: `お知らせ${index}`,
        body: `本文${index}`,
        url: null,
      })
    }

    const results = await Promise.allSettled([
      createAnnouncement(db, 1, {
        title: '同時追加A',
        body: '本文A',
        url: null,
      }),
      createAnnouncement(db, 1, {
        title: '同時追加B',
        body: '本文B',
        url: null,
      }),
    ])

    const fulfilled = results.filter(({ status }) => status === 'fulfilled')
    const rejected = results.find(({ status }) => status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    if (rejected?.status !== 'rejected') {
      throw new Error('上限超過が拒否されていない')
    }
    expect(rejected.reason).toEqual(new Error(ANNOUNCEMENT_LIMIT_MESSAGE))
    expect(await listAnnouncementsForConcert(db, 1)).toHaveLength(
      MAX_ANNOUNCEMENTS,
    )
  })

  it('演奏会ごとに分離する', async () => {
    await createAnnouncement(db, 1, {
      title: 'A',
      body: '本文A',
      url: 'https://example.com/a',
    })
    await createAnnouncement(db, 2, {
      title: 'B',
      body: '本文B',
      url: null,
    })

    expect(await titles(1)).toEqual(['A'])
    expect(await titles(2)).toEqual(['B'])
  })
})

describe('updateAnnouncement', () => {
  it('タイトル・本文・URLを編集でき、作成日時は変えない', async () => {
    await createAnnouncement(db, 1, {
      title: '編集前',
      body: '前の本文',
      url: 'https://example.com/before',
    })
    const [created] = await listAnnouncementsForConcert(db, 1)
    if (!created) throw new Error('お知らせが登録できていない')

    await updateAnnouncement(db, created.id, {
      title: '編集後',
      body: '後の本文',
      url: null,
    })

    const [updated] = await listAnnouncementsForConcert(db, 1)
    expect(updated).toMatchObject({
      title: '編集後',
      body: '後の本文',
      url: null,
      createdAt: created.createdAt,
    })
  })

  it('編集しても掲載順は作成日時の順のまま', async () => {
    await db.insert(announcements).values([
      {
        id: 1,
        concertId: 1,
        title: '古い',
        body: '本文1',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 2,
        concertId: 1,
        title: '新しい',
        body: '本文2',
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      },
    ])

    await updateAnnouncement(db, 1, {
      title: '古いを編集',
      body: '更新',
      url: null,
    })

    expect(await titles()).toEqual(['新しい', '古いを編集'])
  })
})

describe('deleteAnnouncement', () => {
  it('指定したお知らせだけを削除する', async () => {
    await createAnnouncement(db, 1, {
      title: '残す',
      body: '本文1',
      url: null,
    })
    await createAnnouncement(db, 1, {
      title: '消す',
      body: '本文2',
      url: null,
    })
    const [newer] = await listAnnouncementsForConcert(db, 1)
    if (!newer) throw new Error('お知らせが登録できていない')

    await deleteAnnouncement(db, newer.id)

    expect(await titles()).toEqual(['残す'])
  })
})
