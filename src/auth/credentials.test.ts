import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { credentials, sessions } from '../db/schema'
import { createTestDb } from '../test/db'
import {
  changePassword,
  listCredentials,
  verifyRolePassword,
} from './credentials'
import { hashPassword } from './password'

const PEPPER = 'test-pepper'

let db: Db

beforeEach(async () => {
  env.PASSWORD_PEPPER = PEPPER
  db = createTestDb()
  await db.insert(credentials).values([
    { role: 'admin', passwordHash: await hashPassword('admin-old', PEPPER) },
    { role: 'extra', passwordHash: await hashPassword('extra-old', PEPPER) },
  ])
})

describe('listCredentials', () => {
  it('ロールと更新時刻を返す', async () => {
    const rows = await listCredentials(db)

    expect(rows.map(({ role }) => role).sort()).toEqual(['admin', 'extra'])
    expect(rows[0]?.updatedAt).toBeTruthy()
  })
})

describe('verifyRolePassword', () => {
  it('合っていれば true、違えば false', async () => {
    expect(await verifyRolePassword(db, 'admin', 'admin-old')).toBe(true)
    expect(await verifyRolePassword(db, 'admin', 'extra-old')).toBe(false)
    expect(await verifyRolePassword(db, 'admin', '')).toBe(false)
  })

  it('行が無いロールは false', async () => {
    await db.delete(credentials)

    expect(await verifyRolePassword(db, 'admin', 'admin-old')).toBe(false)
  })
})

describe('changePassword', () => {
  it('新しいパスワードだけが通るようになる', async () => {
    await changePassword(db, 'extra', 'extra-new')

    expect(await verifyRolePassword(db, 'extra', 'extra-new')).toBe(true)
    expect(await verifyRolePassword(db, 'extra', 'extra-old')).toBe(false)
  })

  it('変えたロールのセッションだけを落とす', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    await db.insert(sessions).values([
      { id: 'admin-session', role: 'admin', expiresAt: future },
      { id: 'extra-session', role: 'extra', expiresAt: future },
    ])

    await changePassword(db, 'extra', 'extra-new')

    expect(await db.select().from(sessions)).toMatchObject([
      { id: 'admin-session' },
    ])
  })

  it('行が無ければ作る', async () => {
    await db.delete(credentials)

    await changePassword(db, 'admin', 'admin-new')

    expect(await verifyRolePassword(db, 'admin', 'admin-new')).toBe(true)
  })

  it('更新時刻が進む', async () => {
    const [before] = await listCredentials(db)
    if (!before) throw new Error('認証情報が入っていない')

    await changePassword(db, before.role, 'whatever-new')
    const after = (await listCredentials(db)).find(
      ({ role }) => role === before.role,
    )
    if (!after) throw new Error('更新した認証情報が見つからない')

    expect(after.updatedAt >= before.updatedAt).toBe(true)
  })
})
