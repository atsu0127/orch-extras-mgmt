/**
 * 一致・不一致で処理時間が変わらない文字列比較（設計書8.2）。
 * 長さが違う場合だけ早期に返すが、比較対象は長さが固定のハッシュなので秘密は漏れない。
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
