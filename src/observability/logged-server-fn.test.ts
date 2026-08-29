import { afterEach, describe, expect, it, vi } from 'vitest'
import { logServerFn } from './logged-server-fn'

afterEach(() => {
  vi.restoreAllMocks()
})

type MiddlewareServer = (opts: {
  next: () => Promise<Record<string, unknown>>
  context: Record<string, unknown>
}) => Promise<unknown>

function serverOf(fn: string): MiddlewareServer {
  const middleware = logServerFn(fn) as unknown as {
    options: { server: MiddlewareServer }
  }
  return middleware.options.server
}

describe('logServerFn', () => {
  it('login 失敗を fn / ok / error 付きで1行出す', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const server = serverOf('login')

    await server({
      context: {},
      next: async () => ({
        context: {},
        result: { ok: false, reason: 'invalid' },
      }),
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const entry = spy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(entry).toMatchObject({
      event: 'server_fn',
      fn: 'login',
      ok: false,
      role: 'anonymous',
      error: 'invalid',
    })
    expect(typeof entry.durationMs).toBe('number')
    expect(JSON.stringify(entry)).not.toContain('203.0.113')
    expect(Object.keys(entry)).not.toEqual(
      expect.arrayContaining(['password', 'ip', 'cookie']),
    )
  })

  it('rate_limited も login の error にする', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await serverOf('login')({
      context: {},
      next: async () => ({
        context: {},
        result: { ok: false, reason: 'rate_limited' },
      }),
    })
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      fn: 'login',
      ok: false,
      error: 'rate_limited',
    })
  })

  it('未認証 redirect を記録してから投げ直す', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const redirect = { isRedirect: true, to: '/login' }
    const server = serverOf('listConcerts')

    await expect(
      server({
        context: {},
        next: async () => {
          throw redirect
        },
      }),
    ).rejects.toBe(redirect)

    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      event: 'server_fn',
      fn: 'listConcerts',
      ok: false,
      role: 'anonymous',
      error: 'unauthenticated',
    })
  })

  it('validator 拒否は validation にして handler 結果は出さない', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const rejection = new Error(
      JSON.stringify(
        [{ message: 'Required', path: ['question'] }],
        undefined,
        2,
      ),
    )
    await expect(
      serverOf('askAssistant')({
        context: { session: { role: 'extra' } },
        next: async () => {
          throw rejection
        },
      }),
    ).rejects.toBe(rejection)

    const entry = spy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(entry).toMatchObject({
      fn: 'askAssistant',
      ok: false,
      error: 'validation',
    })
    expect(JSON.stringify(entry)).not.toContain('question')
  })

  it('成功時は session の role を使い ok: true にする', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    await serverOf('addPractice')({
      context: {},
      next: async () => ({
        context: { session: { role: 'admin', id: 'sess' } },
        result: { id: 1 },
      }),
    })
    const entry = spy.mock.calls[0]?.[0]
    expect(entry).toMatchObject({
      fn: 'addPractice',
      ok: true,
      role: 'admin',
    })
    expect(entry && typeof entry === 'object' && 'error' in entry).toBe(false)
  })
})
