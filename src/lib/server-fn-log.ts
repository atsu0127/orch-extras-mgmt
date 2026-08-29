import type { Role } from './roles'

export const SERVER_FN_EVENT = 'server_fn' as const

export type ServerFnLogRole = Role | 'anonymous'

export type ServerFnLog = {
  event: typeof SERVER_FN_EVENT
  fn: string
  ok: boolean
  durationMs: number
  role: ServerFnLogRole
  error?: string
}

const SENSITIVE_KEY_PATTERN =
  /^(password|cookie|authorization|ip|question|answer|token|session)$/i

export function buildServerFnLog(input: {
  fn: string
  ok: boolean
  durationMs: number
  role: ServerFnLogRole
  error?: string
}): ServerFnLog {
  if (input.ok) {
    return {
      event: SERVER_FN_EVENT,
      fn: input.fn,
      ok: true,
      durationMs: input.durationMs,
      role: input.role,
    }
  }
  return {
    event: SERVER_FN_EVENT,
    fn: input.fn,
    ok: false,
    durationMs: input.durationMs,
    role: input.role,
    error: input.error ?? 'Error',
  }
}

export function logContainsSensitiveKeys(entry: object): boolean {
  return Object.keys(entry).some((key) => SENSITIVE_KEY_PATTERN.test(key))
}

export function roleFromContextAndResult(
  context: unknown,
  result: unknown,
): ServerFnLogRole {
  const fromSession = sessionRole(context)
  if (fromSession) return fromSession
  if (isRecord(result) && result.ok === true) {
    const role = result.role
    if (role === 'admin' || role === 'extra') return role
  }
  return 'anonymous'
}

export function outcomeFromResult(
  result: unknown,
): { ok: true } | { ok: false; error: string } {
  if (isRecord(result) && result.ok === false) {
    const reason = result.reason
    if (typeof reason === 'string' && reason.length > 0) {
      return { ok: false, error: reason }
    }
    return { ok: false, error: 'failed' }
  }
  return { ok: true }
}

export function classifyThrownError(error: unknown): string {
  if (isRedirectLike(error)) {
    return error.to === '/login' ? 'unauthenticated' : 'redirect'
  }
  if (isValidatorRejection(error)) return 'validation'
  if (error instanceof Error && error.name.length > 0) return error.name
  return 'Error'
}

function sessionRole(context: unknown): Role | null {
  if (!isRecord(context)) return null
  const session = context.session
  if (!isRecord(session)) return null
  const role = session.role
  if (role === 'admin' || role === 'extra') return role
  return null
}

function isRedirectLike(
  error: unknown,
): error is { isRedirect: true; to?: unknown } {
  return isRecord(error) && error.isRedirect === true
}

/**
 * Start の execValidator は Standard Schema の issues を JSON 文字列にした
 * Error を投げる。メッセージ本文は出さず、コードだけ使う。
 */
export function isValidatorRejection(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.trim()
  if (!message.startsWith('[')) return false
  try {
    const parsed: unknown = JSON.parse(message)
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
