import { describe, expect, it } from 'vitest'
import {
  buildServerFnLog,
  classifyThrownError,
  logContainsSensitiveKeys,
  outcomeFromResult,
  roleFromContextAndResult,
} from './server-fn-log'

describe('buildServerFnLog', () => {
  it('成功時は error を付けない', () => {
    const entry = buildServerFnLog({
      fn: 'listConcerts',
      ok: true,
      durationMs: 4,
      role: 'extra',
    })
    expect(entry).toEqual({
      event: 'server_fn',
      fn: 'listConcerts',
      ok: true,
      durationMs: 4,
      role: 'extra',
    })
    expect('error' in entry).toBe(false)
  })

  it('失敗時の JSON 形を固定し、本文や IP のキーを載せない', () => {
    const entry = buildServerFnLog({
      fn: 'login',
      ok: false,
      durationMs: 2,
      role: 'anonymous',
      error: 'invalid',
    })
    expect(entry).toEqual({
      event: 'server_fn',
      fn: 'login',
      ok: false,
      durationMs: 2,
      role: 'anonymous',
      error: 'invalid',
    })
    expect(Object.keys(entry).sort()).toEqual([
      'durationMs',
      'error',
      'event',
      'fn',
      'ok',
      'role',
    ])
    expect(logContainsSensitiveKeys(entry)).toBe(false)
    const json = JSON.stringify(entry)
    expect(json).not.toContain('203.0.113')
    expect(json).not.toContain('password')
    expect(json).not.toContain('__Host-oem_session')
  })
})

describe('outcomeFromResult', () => {
  it('login の invalid / rate_limited を error にする', () => {
    expect(outcomeFromResult({ ok: false, reason: 'invalid' })).toEqual({
      ok: false,
      error: 'invalid',
    })
    expect(outcomeFromResult({ ok: false, reason: 'rate_limited' })).toEqual({
      ok: false,
      error: 'rate_limited',
    })
  })

  it('{ ok: false } で reason が無いときは failed にする', () => {
    expect(outcomeFromResult({ ok: false })).toEqual({
      ok: false,
      error: 'failed',
    })
  })

  it('成功とみなす戻り値は true にする', () => {
    expect(outcomeFromResult({ ok: true, role: 'admin' })).toEqual({ ok: true })
    expect(outcomeFromResult({ concerts: [] })).toEqual({ ok: true })
    expect(outcomeFromResult(undefined)).toEqual({ ok: true })
  })

  it('message 本文は error に使わない', () => {
    expect(
      outcomeFromResult({ ok: false, message: '会場が見つかりません' }),
    ).toEqual({ ok: false, error: 'failed' })
  })
})

describe('classifyThrownError', () => {
  it('未認証 redirect は unauthenticated にする', () => {
    expect(classifyThrownError({ isRedirect: true, to: '/login' })).toBe(
      'unauthenticated',
    )
  })

  it('それ以外の redirect は短いコードにする', () => {
    expect(classifyThrownError({ isRedirect: true, to: '/' })).toBe('redirect')
  })

  it('validator 拒否は validation にする', () => {
    const error = new Error(
      JSON.stringify(
        [{ message: 'Required', path: ['password'] }],
        undefined,
        2,
      ),
    )
    expect(classifyThrownError(error)).toBe('validation')
  })

  it('その他の例外はクラス名だけ使う', () => {
    class DbBoom extends Error {
      constructor() {
        super('SELECT * FROM secrets')
        this.name = 'DbBoom'
      }
    }
    expect(classifyThrownError(new DbBoom())).toBe('DbBoom')
    expect(classifyThrownError(new DbBoom())).not.toContain('SELECT')
  })
})

describe('roleFromContextAndResult', () => {
  it('requireAuth が載せた session を使う', () => {
    expect(
      roleFromContextAndResult({ session: { role: 'admin', id: 's1' } }, {}),
    ).toBe('admin')
  })

  it('login 成功時は戻り値のロールを使う', () => {
    expect(roleFromContextAndResult({}, { ok: true, role: 'extra' })).toBe(
      'extra',
    )
  })

  it('未ログインは anonymous にする', () => {
    expect(roleFromContextAndResult({}, { ok: false, reason: 'invalid' })).toBe(
      'anonymous',
    )
  })
})
