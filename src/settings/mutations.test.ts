import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { appSettings } from '../db/schema'
import { createTestDb } from '../test/db'
import { updateAdminEmail } from './mutations'
import { getAppSettings } from './queries'

let db: Db

beforeEach(() => {
  db = createTestDb()
})

describe('app settings', () => {
  it('行が無いときは管理者メール未設定として返す', async () => {
    await expect(getAppSettings(db)).resolves.toEqual({ adminEmail: null })
  })

  it('固定ID 1で初回作成し、上書きと解除ができる', async () => {
    await updateAdminEmail(db, 'first@example.com')
    expect(await getAppSettings(db)).toEqual({
      adminEmail: 'first@example.com',
    })

    await updateAdminEmail(db, 'updated@example.com')
    expect(await getAppSettings(db)).toEqual({
      adminEmail: 'updated@example.com',
    })

    await updateAdminEmail(db, null)
    expect(await getAppSettings(db)).toEqual({ adminEmail: null })
    expect(await db.select({ id: appSettings.id }).from(appSettings)).toEqual([
      { id: 1 },
    ])
  })
})
