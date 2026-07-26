import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'
import { timingSafeEqual } from './timing-safe-equal'

const PEPPER = 'test-pepper'

describe('hashPassword', () => {
  it('アルゴリズム識別子とバージョンを含む形式で返す', async () => {
    const hash = await hashPassword('correct horse', PEPPER)

    expect(hash).toMatch(/^hmac-sha256\$v1\$[0-9a-f]{64}$/)
  })

  it('同じパスワードと pepper なら同じ結果になる', async () => {
    const [first, second] = await Promise.all([
      hashPassword('correct horse', PEPPER),
      hashPassword('correct horse', PEPPER),
    ])

    expect(first).toBe(second)
  })

  it('pepper が違えば別の結果になる', async () => {
    const [first, second] = await Promise.all([
      hashPassword('correct horse', PEPPER),
      hashPassword('correct horse', 'another-pepper'),
    ])

    expect(first).not.toBe(second)
  })

  it('pepper が空なら失敗させる', async () => {
    await expect(hashPassword('correct horse', '')).rejects.toThrow(
      'PASSWORD_PEPPER',
    )
  })
})

describe('verifyPassword', () => {
  it('正しいパスワードを受け入れる', async () => {
    const hash = await hashPassword('correct horse', PEPPER)

    await expect(verifyPassword('correct horse', hash, PEPPER)).resolves.toBe(
      true,
    )
  })

  it('誤ったパスワードを拒否する', async () => {
    const hash = await hashPassword('correct horse', PEPPER)

    await expect(verifyPassword('wrong horse', hash, PEPPER)).resolves.toBe(
      false,
    )
  })

  it('pepper が違えば拒否する', async () => {
    const hash = await hashPassword('correct horse', PEPPER)

    await expect(
      verifyPassword('correct horse', hash, 'another-pepper'),
    ).resolves.toBe(false)
  })

  it.each([
    ['空文字', ''],
    ['区切りが無い', 'deadbeef'],
    ['ダイジェストが欠けている', 'hmac-sha256$v1$'],
    ['未知のアルゴリズム', 'argon2id$v1$deadbeef'],
    ['未知のバージョン', 'hmac-sha256$v2$deadbeef'],
  ])('保存形式が %s なら拒否する', async (_label, storedHash) => {
    await expect(
      verifyPassword('correct horse', storedHash, PEPPER),
    ).resolves.toBe(false)
  })
})

describe('timingSafeEqual', () => {
  it('同じ文字列なら true を返す', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
  })

  it.each([
    ['先頭だけ違う', 'Xbc123'],
    ['末尾だけ違う', 'abc12X'],
    ['長さが違う', 'abc1234'],
  ])('%s 場合は false を返す', (_label, other) => {
    expect(timingSafeEqual('abc123', other)).toBe(false)
  })
})
