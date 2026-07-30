import { describe, expect, it } from 'vitest'
import { buildInquiryMailtoUrl } from './external-urls'

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
