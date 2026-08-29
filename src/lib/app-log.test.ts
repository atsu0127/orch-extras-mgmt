import { afterEach, describe, expect, it, vi } from 'vitest'
import { emitAppLog } from './app-log'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('emitAppLog', () => {
  it('オブジェクトをそのまま console.log に渡す', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const entry = { event: 'server_fn', fn: 'login', ok: true }
    emitAppLog(entry)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(entry)
    expect(typeof spy.mock.calls[0]?.[0]).toBe('object')
  })
})
