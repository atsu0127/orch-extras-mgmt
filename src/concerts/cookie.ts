/**
 * 選択中の演奏会を覚えておく Cookie（設計書7.1）。
 *
 * 認証の Cookie と違い、これは表示上の好みでしかない。書き換えられても他人のデータは見えず、
 * 見せるものはサーバ関数側の認可で決まる。よってサーバ関数を1往復増やさず、
 * 選択を解決するクライアント側でそのまま読み書きする。
 */

const CONCERT_COOKIE = 'oem_concert'

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${CONCERT_COOKIE}=(\\d+)`)

export function readRememberedConcert(): number | undefined {
  if (typeof document === 'undefined') return undefined

  const value = COOKIE_PATTERN.exec(document.cookie)?.[1]
  return value === undefined ? undefined : Number(value)
}

export function rememberConcert(id: number): void {
  if (typeof document === 'undefined') return

  // 開発中は http で動くため、Secure は https のときだけ付ける
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  // biome-ignore lint/suspicious/noDocumentCookie: 代替の Cookie Store API を iOS Safari が実装していない
  document.cookie = `${CONCERT_COOKIE}=${id}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
}
