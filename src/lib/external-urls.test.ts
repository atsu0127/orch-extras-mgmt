import { describe, expect, it } from 'vitest'
import {
  buildGoogleMapsUrl,
  buildInquiryMailtoUrl,
  buildPerformanceCalendarUrl,
  buildPracticeCalendarUrl,
} from './external-urls'

describe('buildGoogleMapsUrl', () => {
  it('日本語、空白、&、#を含む住所をGoogle Maps検索URLへエンコードする', () => {
    expect(buildGoogleMapsUrl('東京都 千代田区1-1 &別館#2')).toBe(
      'https://www.google.com/maps/search/?api=1&query=%E6%9D%B1%E4%BA%AC%E9%83%BD%20%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA1-1%20%26%E5%88%A5%E9%A4%A8%232',
    )
  })
})

describe('buildInquiryMailtoUrl', () => {
  it('管理者宛てに演奏会名入りの件名と本文ひな形をエンコードする', () => {
    const url = buildInquiryMailtoUrl(
      'admin@example.com',
      '第10回 定期&特別演奏会',
    )
    const parsed = new URL(url)

    expect(parsed.protocol).toBe('mailto:')
    expect(parsed.pathname).toBe('admin@example.com')
    expect(parsed.searchParams.get('subject')).toBe(
      '【第10回 定期&特別演奏会】エキストラからの問い合わせ',
    )
    expect(parsed.searchParams.get('body')).toBe(
      '演奏会名：第10回 定期&特別演奏会\r\n氏名：\r\n問い合わせ内容：',
    )
    expect(url).toContain('%20')
    expect(url).toContain('%0D%0A')
    expect(url).not.toContain('+')
  })

  it('演奏会名のCRとLFを空白へ置換して件名と本文への改行挿入を防ぐ', () => {
    const url = buildInquiryMailtoUrl(
      'admin@example.com',
      '第10回\r\n定期\n特別\r演奏会',
    )
    const parsed = new URL(url)

    expect(parsed.searchParams.get('subject')).toBe(
      '【第10回 定期 特別 演奏会】エキストラからの問い合わせ',
    )
    expect(parsed.searchParams.get('body')).toBe(
      '演奏会名：第10回 定期 特別 演奏会\r\n氏名：\r\n問い合わせ内容：',
    )
  })
})

describe('buildPerformanceCalendarUrl', () => {
  it('通常日の本番を翌日終了の終日予定にする', () => {
    const url = buildPerformanceCalendarUrl({
      concertName: '第10回 定期&特別演奏会',
      date: '2026-11-30',
      venue: {
        name: '市民ホール & 大ホール',
        address: '東京都 千代田区1-1 #2',
      },
    })
    const parsed = new URL(url ?? '')

    expect(parsed.origin + parsed.pathname).toBe(
      'https://calendar.google.com/calendar/render',
    )
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE')
    expect(parsed.searchParams.get('text')).toBe('第10回 定期&特別演奏会')
    expect(parsed.searchParams.get('dates')).toBe('20261130/20261201')
    expect(parsed.searchParams.get('location')).toBe(
      '市民ホール & 大ホール 東京都 千代田区1-1 #2',
    )
    expect(parsed.searchParams.has('ctz')).toBe(false)
  })

  it.each([
    ['2026-12-31', '20261231/20270101'],
    ['2028-02-29', '20280229/20280301'],
  ])('%s の翌日を月・年の境界を越えて計算する', (date, dates) => {
    const url = buildPerformanceCalendarUrl({
      concertName: '演奏会',
      date,
      venue: null,
    })
    const parsed = new URL(url ?? '')

    expect(parsed.searchParams.get('dates')).toBe(dates)
    expect(parsed.searchParams.has('location')).toBe(false)
  })

  it.each([
    ['0001-01-01', '00010101/00010102'],
    ['9999-12-30', '99991230/99991231'],
  ])('4桁年の有効範囲内ならURLを返す', (date, dates) => {
    const url = buildPerformanceCalendarUrl({
      concertName: '演奏会',
      date,
      venue: null,
    })
    const parsed = new URL(url ?? '')

    expect(parsed.searchParams.get('dates')).toBe(dates)
  })

  it('年0000ならnullを返す', () => {
    expect(
      buildPerformanceCalendarUrl({
        concertName: '演奏会',
        date: '0000-01-01',
        venue: null,
      }),
    ).toBeNull()
  })

  it('9999-12-31は終日予定の翌日を4桁年で表せないためnullを返す', () => {
    expect(
      buildPerformanceCalendarUrl({
        concertName: '演奏会',
        date: '9999-12-31',
        venue: null,
      }),
    ).toBeNull()
  })

  it.each(['2026-02-29', '2026-04-31', '2026-13-01', 'not-a-date'])(
    '不正な本番日 %s ならnullを返す',
    (date) => {
      expect(
        buildPerformanceCalendarUrl({
          concertName: '演奏会',
          date,
          venue: null,
        }),
      ).toBeNull()
    },
  )
})

describe('buildPracticeCalendarUrl', () => {
  it('両時刻が正しければ日本時間の時刻入り予定にする', () => {
    const url = buildPracticeCalendarUrl({
      concertName: '第10回 定期&特別演奏会',
      date: '2026-08-01',
      startTime: '13:00',
      endTime: '17:00',
      venue: {
        name: '市民ホール & 大ホール',
        address: '東京都 千代田区1-1 #2',
      },
    })
    const parsed = new URL(url ?? '')

    expect(parsed.searchParams.get('text')).toBe('第10回 定期&特別演奏会 練習')
    expect(parsed.searchParams.get('dates')).toBe(
      '20260801T130000/20260801T170000',
    )
    expect(parsed.searchParams.get('ctz')).toBe('Asia/Tokyo')
    expect(parsed.searchParams.get('location')).toBe(
      '市民ホール & 大ホール 東京都 千代田区1-1 #2',
    )
    expect(url).not.toContain('Z')
  })

  it('9999-12-31も時刻入り予定ならURLを返す', () => {
    const url = buildPracticeCalendarUrl({
      concertName: '演奏会',
      date: '9999-12-31',
      startTime: '13:00',
      endTime: '17:00',
      venue: null,
    })
    const parsed = new URL(url ?? '')

    expect(parsed.searchParams.get('dates')).toBe(
      '99991231T130000/99991231T170000',
    )
  })

  it('9999-12-31の終日練習は翌日を4桁年で表せないためnullを返す', () => {
    expect(
      buildPracticeCalendarUrl({
        concertName: '演奏会',
        date: '9999-12-31',
        startTime: null,
        endTime: null,
        venue: null,
      }),
    ).toBeNull()
  })

  it.each([
    ['13:00', '13:00'],
    ['17:00', '13:00'],
  ])('両時刻があっても終了が開始以前ならnullを返す', (startTime, endTime) => {
    expect(
      buildPracticeCalendarUrl({
        concertName: '演奏会',
        date: '2026-08-01',
        startTime,
        endTime,
        venue: null,
      }),
    ).toBeNull()
  })

  it.each([
    ['13:00', null],
    [null, '17:00'],
    ['', '17:00'],
  ])('時刻が片方欠けていれば翌日終了の終日予定にする', (startTime, endTime) => {
    const url = buildPracticeCalendarUrl({
      concertName: '演奏会',
      date: '2026-08-01',
      startTime,
      endTime,
      venue: null,
    })
    const parsed = new URL(url ?? '')

    expect(parsed.searchParams.get('dates')).toBe('20260801/20260802')
    expect(parsed.searchParams.has('ctz')).toBe(false)
    expect(parsed.searchParams.has('location')).toBe(false)
  })

  it.each([
    ['2026-02-29', '13:00', '17:00'],
    ['2026-08-01', '24:00', '17:00'],
    ['2026-08-01', '13:00', '17:60'],
    ['2026-08-01', 'invalid', null],
  ])('不正な日付・非空時刻ならnullを返す', (date, startTime, endTime) => {
    expect(
      buildPracticeCalendarUrl({
        concertName: '演奏会',
        date,
        startTime,
        endTime,
        venue: null,
      }),
    ).toBeNull()
  })
})
