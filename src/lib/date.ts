/**
 * 練習の日付・時刻は日本時間の文字列としてそのまま扱う（設計書5.4）。
 * ここでは `Date` を経由した変換を挟まず、文字列のまま組み立てる。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** UTC で持っている時刻を日本時間の暦日 `YYYY-MM-DD` にする */
export function jstDateOf(instant: Date): string {
  return new Date(instant.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 日本時間の「今日」を `YYYY-MM-DD` で返す。実行環境のタイムゾーンに依存しない */
export function todayInJst(now: Date = new Date()): string {
  return jstDateOf(now)
}

/** `2026-08-01` → `8月1日(土)`。形式が違うものはそのまま返す */
export function formatDate(date: string): string {
  if (!DATE_PATTERN.test(date)) return date

  return `${formatMonthDay(date)}(${weekdayOf(date)})`
}

/** `2026-08-01` → `2026年8月1日`。年をまたぐ演奏会を見分けるのに使う */
export function formatFullDate(date: string): string {
  if (!DATE_PATTERN.test(date)) return date

  return `${date.slice(0, 4)}年${formatMonthDay(date)}`
}

function formatMonthDay(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`
}

/** `2026-08-01` → `土`。UTC 固定で解釈するので実行環境で曜日がずれない */
export function weekdayOf(date: string): string {
  const index = new Date(`${date}T00:00:00Z`).getUTCDay()
  return WEEKDAYS[index] ?? ''
}

/** 開始・終了のどちらが欠けていても読める形にする。両方無ければ空文字 */
export function formatTimeRange(
  startTime: string | null,
  endTime: string | null,
): string {
  if (startTime && endTime) return `${startTime}〜${endTime}`
  if (startTime) return `${startTime}〜`
  if (endTime) return `〜${endTime}`
  return ''
}
