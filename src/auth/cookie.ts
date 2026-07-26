import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { SESSION_TTL_MS } from './session'

/**
 * `__Host-` 接頭辞は Secure・Path=/・Domain 無しを要求し、サブドメインから
 * 上書きされないことをブラウザ側で保証させる（設計書8.3）。
 */
const SESSION_COOKIE = '__Host-oem_session'

const ATTRIBUTES = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const

export function readSessionCookie(): string | undefined {
  return getCookie(SESSION_COOKIE)
}

export function writeSessionCookie(token: string): void {
  setCookie(SESSION_COOKIE, token, {
    ...ATTRIBUTES,
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE, ATTRIBUTES)
}
