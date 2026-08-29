import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cleanupAuthData: vi.fn(),
  clearSessionCookie: vi.fn(),
  getClientIp: vi.fn(),
  getDb: vi.fn(),
  isLoginBlocked: vi.fn(),
  issueSession: vi.fn(),
  readSessionCookie: vi.fn(),
  recordLoginAttempt: vi.fn(),
  resolveSession: vi.fn(),
  revokeSession: vi.fn(),
  verifyPassword: vi.fn(),
  writeSessionCookie: vi.fn(),
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const builder = {
      handler: (handler: unknown) => handler,
      middleware: () => builder,
      validator: () => builder,
    }
    return builder
  },
  createMiddleware: () => ({
    server: () => ({}),
  }),
}))

vi.mock('../db/client', () => ({ getDb: mocks.getDb }))
vi.mock('./cleanup', () => ({ cleanupAuthData: mocks.cleanupAuthData }))
vi.mock('./client-ip', () => ({ getClientIp: mocks.getClientIp }))
vi.mock('./cookie', () => ({
  clearSessionCookie: mocks.clearSessionCookie,
  readSessionCookie: mocks.readSessionCookie,
  writeSessionCookie: mocks.writeSessionCookie,
}))
vi.mock('./middleware', () => ({ requireAuth: {} }))
vi.mock('./password', () => ({ verifyPassword: mocks.verifyPassword }))
vi.mock('./rate-limit', () => ({
  isLoginBlocked: mocks.isLoginBlocked,
  recordLoginAttempt: mocks.recordLoginAttempt,
}))
vi.mock('./session', () => ({
  issueSession: mocks.issueSession,
  resolveSession: mocks.resolveSession,
  revokeSession: mocks.revokeSession,
}))

import { login } from './functions'

const IP = '203.0.113.10'
const TOKEN = 'new-session-token'
const db = {
  select: () => ({
    from: async () => [
      { role: 'admin', hash: 'admin-hash' },
      { role: 'extra', hash: 'extra-hash' },
    ],
  }),
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getDb.mockReturnValue(db)
  mocks.getClientIp.mockReturnValue(IP)
  mocks.isLoginBlocked.mockResolvedValue(false)
  mocks.issueSession.mockResolvedValue(TOKEN)
  mocks.cleanupAuthData.mockResolvedValue(undefined)
  mocks.verifyPassword.mockImplementation(
    async (password: string, hash: string) =>
      password === 'admin-password' && hash === 'admin-hash',
  )
})

describe('login', () => {
  it('セッション発行後に掃除し、掃除成功後にCookieを書く', async () => {
    await expect(
      login({ data: { password: 'admin-password' } }),
    ).resolves.toEqual({ ok: true, role: 'admin' })

    expect(mocks.cleanupAuthData).toHaveBeenCalledWith(db, expect.any(Date))
    expect(mocks.writeSessionCookie).toHaveBeenCalledWith(TOKEN)
    expect(mocks.issueSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cleanupAuthData.mock.invocationCallOrder[0] ?? 0,
    )
    expect(mocks.cleanupAuthData.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.writeSessionCookie.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it('不正なパスワードでは掃除しない', async () => {
    await expect(login({ data: { password: 'wrong' } })).resolves.toEqual({
      ok: false,
      reason: 'invalid',
    })

    expect(mocks.cleanupAuthData).not.toHaveBeenCalled()
    expect(mocks.writeSessionCookie).not.toHaveBeenCalled()
  })

  it('レート制限時は掃除しない', async () => {
    mocks.isLoginBlocked.mockResolvedValue(true)

    await expect(
      login({ data: { password: 'admin-password' } }),
    ).resolves.toEqual({ ok: false, reason: 'rate_limited' })

    expect(mocks.cleanupAuthData).not.toHaveBeenCalled()
    expect(mocks.issueSession).not.toHaveBeenCalled()
    expect(mocks.writeSessionCookie).not.toHaveBeenCalled()
  })

  it('掃除失敗時はログインを失敗させてCookieを書かない', async () => {
    const failure = new Error('cleanup failed')
    mocks.cleanupAuthData.mockRejectedValue(failure)

    await expect(login({ data: { password: 'admin-password' } })).rejects.toBe(
      failure,
    )

    expect(mocks.issueSession).toHaveBeenCalled()
    expect(mocks.writeSessionCookie).not.toHaveBeenCalled()
  })
})
