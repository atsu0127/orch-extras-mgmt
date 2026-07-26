import { describe, expect, it } from 'vitest'
import { formatDate, formatTimeRange, todayInJst, weekdayOf } from './date'

describe('todayInJst', () => {
  it('UTC の日付が変わる前でも日本時間の日付を返す', () => {
    expect(todayInJst(new Date('2026-07-26T15:00:00.000Z'))).toBe('2026-07-27')
  })

  it('日本時間で日付が変わる直前は前日のままになる', () => {
    expect(todayInJst(new Date('2026-07-26T14:59:59.999Z'))).toBe('2026-07-26')
  })

  it('UTC の日付が変わった直後も日本時間では同じ日', () => {
    expect(todayInJst(new Date('2026-07-27T00:00:00.000Z'))).toBe('2026-07-27')
  })
})

describe('weekdayOf', () => {
  it('曜日を日本語1文字で返す', () => {
    expect(weekdayOf('2026-07-27')).toBe('月')
    expect(weekdayOf('2026-08-01')).toBe('土')
    expect(weekdayOf('2026-08-02')).toBe('日')
  })
})

describe('formatDate', () => {
  it('月日と曜日に整える', () => {
    expect(formatDate('2026-08-01')).toBe('8月1日(土)')
  })

  it('ゼロ埋めを外す', () => {
    expect(formatDate('2026-01-05')).toBe('1月5日(月)')
  })

  it('想定外の形式はそのまま返す', () => {
    expect(formatDate('2026/08/01')).toBe('2026/08/01')
  })
})

describe('formatTimeRange', () => {
  it('両方あれば範囲にする', () => {
    expect(formatTimeRange('13:00', '17:00')).toBe('13:00〜17:00')
  })

  it('片方だけでも読める形にする', () => {
    expect(formatTimeRange('13:00', null)).toBe('13:00〜')
    expect(formatTimeRange(null, '17:00')).toBe('〜17:00')
  })

  it('両方無ければ空文字', () => {
    expect(formatTimeRange(null, null)).toBe('')
  })
})
