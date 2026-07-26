import { timingSafeEqual } from './timing-safe-equal'

const ALGORITHM = 'hmac-sha256'
const VERSION = 'v1'

/**
 * 保存形式は `hmac-sha256$v1$<hex>`（設計書8.2）。先頭の識別子は、
 * より強い方式へ段階移行するときに検証側で分岐するために付けている。
 */
export async function hashPassword(
  password: string,
  pepper: string,
): Promise<string> {
  const digest = await hmacSha256Hex(password, pepper)
  return `${ALGORITHM}$${VERSION}$${digest}`
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  pepper: string,
): Promise<boolean> {
  const [algorithm, version, expected] = storedHash.split('$')
  if (algorithm !== ALGORITHM || version !== VERSION || !expected) {
    return false
  }

  const actual = await hmacSha256Hex(password, pepper)
  return timingSafeEqual(actual, expected)
}

async function hmacSha256Hex(message: string, pepper: string): Promise<string> {
  // pepper が空のまま動くと DB 単体で総当たりできる状態になるため、必ず止める
  if (pepper === '') {
    throw new Error('PASSWORD_PEPPER が設定されていません')
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  )

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
