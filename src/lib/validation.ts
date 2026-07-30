import { z } from 'zod'
import { MAX_LENGTH } from './limits'

/**
 * サーバ関数の入力検証（設計書6.3）で使う共通の部品。同じスキーマをフォームでも
 * 使い、入力の可否とエラー文をサーバとクライアントで一致させる。
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const MESSAGES = {
  required: '入力してください',
  url: 'http:// または https:// で始まる URL を入力してください',
  email: 'メールアドレスの形式で入力してください',
  date: '実在する日付を入力してください',
  time: '時刻は 00:00〜23:59 の形式で入力してください',
} as const

const tooLong = (max: number) => `${max}文字以内で入力してください`
const email = z.email({ error: MESSAGES.email })

/** 更新・削除の対象を指す id。実在するかは各操作のクエリ側で確かめる */
export const idValue = z.number().int().positive()

export function requiredText(max: number) {
  return z.string().trim().min(1, MESSAGES.required).max(max, tooLong(max))
}

/**
 * 任意のテキスト。フォームは空欄を空文字で送るので、DB には空文字を残さず null に寄せる。
 * 「未設定」の判定を列が null かどうかだけで済ませられる。
 */
export function optionalText(max: number) {
  return z.string().trim().max(max, tooLong(max)).transform(blankToNull)
}

export const requiredUrl = z
  .string()
  .trim()
  .min(1, MESSAGES.required)
  .max(MAX_LENGTH.url, tooLong(MAX_LENGTH.url))
  .refine(isHttpUrl, MESSAGES.url)

export const optionalUrl = z
  .string()
  .trim()
  .max(MAX_LENGTH.url, tooLong(MAX_LENGTH.url))
  .refine((value) => value === '' || isHttpUrl(value), MESSAGES.url)
  .transform(blankToNull)

export const optionalEmail = z
  .string()
  .trim()
  .max(MAX_LENGTH.adminEmail, tooLong(MAX_LENGTH.adminEmail))
  .refine(
    (value) => value === '' || email.safeParse(value).success,
    MESSAGES.email,
  )
  .transform(blankToNull)

export const requiredDate = z
  .string()
  .trim()
  .min(1, MESSAGES.required)
  .refine(isCalendarDate, MESSAGES.date)

export const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === '' || isCalendarDate(value), MESSAGES.date)
  .transform(blankToNull)

export const optionalTime = z
  .string()
  .trim()
  .refine((value) => value === '' || TIME_PATTERN.test(value), MESSAGES.time)
  .transform(blankToNull)

/** 会場のように「未設定」を選べる参照 */
export const optionalId = idValue.nullable()

/** `<select>` の値は文字列なので、未選択の空文字を null に読み替える */
export function toOptionalId(value: string): number | null {
  return value === '' ? null : Number(value)
}

export type FieldErrors = Record<string, string>

/**
 * zod のエラーを項目名で引ける形にする。1項目に複数出ても最初の1件だけ見せる。
 * まとめて並べても直す順番は変わらない。
 */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key !== 'string' || key in errors) continue
    errors[key] = issue.message
  }
  return errors
}

function blankToNull(value: string): string | null {
  return value === '' ? null : value
}

/** `javascript:` などを排除する（設計書6.3）。解釈できない相対 URL も弾かれる */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * `YYYY-MM-DD` で、かつ実在する日付か。`2026-02-31` のような値を弾く。
 * タイムゾーン変換のためではなく検証のために `Date` を通している（設計書5.4）。
 */
function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false

  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}
