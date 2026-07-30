import { describe, expect, it } from 'vitest'
import { buildGoogleMapsUrl, buildInquiryMailtoUrl } from './external-urls'

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
