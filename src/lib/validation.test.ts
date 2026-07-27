import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  fieldErrors,
  MESSAGES,
  optionalDate,
  optionalId,
  optionalText,
  optionalTime,
  optionalUrl,
  requiredDate,
  requiredText,
  requiredUrl,
} from './validation'

describe('requiredText', () => {
  const schema = requiredText(5)

  it('前後の空白を落とす', () => {
    expect(schema.parse('  練習  ')).toBe('練習')
  })

  it('空白だけの入力を未入力として弾く', () => {
    expect(schema.safeParse('   ').success).toBe(false)
  })

  it('空白を落とした長さで上限を判定する', () => {
    expect(schema.parse('あいうえお  ')).toBe('あいうえお')
    expect(schema.safeParse('あいうえおか').success).toBe(false)
  })
})

describe('optionalText', () => {
  const schema = optionalText(5)

  it('空欄を null に寄せる', () => {
    expect(schema.parse('')).toBeNull()
    expect(schema.parse('   ')).toBeNull()
  })

  it('上限を超える入力を弾く', () => {
    expect(schema.safeParse('あいうえおか').success).toBe(false)
  })
})

describe('URL の検証', () => {
  it('http と https だけを通す', () => {
    expect(requiredUrl.parse('https://example.com/a')).toBe(
      'https://example.com/a',
    )
    expect(requiredUrl.parse('http://example.com')).toBe('http://example.com')
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'example.com/a',
    '/relative/path',
    'ftp://example.com',
  ])('%s を弾く', (value) => {
    expect(requiredUrl.safeParse(value).success).toBe(false)
  })

  it('必須の URL は空欄を弾く', () => {
    expect(requiredUrl.safeParse('').success).toBe(false)
  })

  it('任意の URL は空欄を null にする', () => {
    expect(optionalUrl.parse('')).toBeNull()
    expect(optionalUrl.parse('  ')).toBeNull()
  })

  it('任意の URL でもスキームは検証する', () => {
    const result = optionalUrl.safeParse('javascript:alert(1)')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(MESSAGES.url)
  })

  it('2000文字を超える URL を弾く', () => {
    const long = `https://example.com/${'a'.repeat(2000)}`
    expect(optionalUrl.safeParse(long).success).toBe(false)
  })
})

describe('日付の検証', () => {
  it('実在する日付を通す', () => {
    expect(requiredDate.parse('2026-08-01')).toBe('2026-08-01')
    expect(requiredDate.parse('2028-02-29')).toBe('2028-02-29')
  })

  it.each(['2026-02-31', '2026-13-01', '2026-8-1', '20260801', '2026-02-29'])(
    '%s を弾く',
    (value) => {
      expect(requiredDate.safeParse(value).success).toBe(false)
    },
  )

  it('任意の日付は空欄を null にする', () => {
    expect(optionalDate.parse('')).toBeNull()
    expect(optionalDate.safeParse('2026-02-31').success).toBe(false)
  })
})

describe('時刻の検証', () => {
  it.each(['00:00', '09:30', '23:59'])('%s を通す', (value) => {
    expect(optionalTime.parse(value)).toBe(value)
  })

  it.each(['24:00', '9:30', '09:60', '0930'])('%s を弾く', (value) => {
    expect(optionalTime.safeParse(value).success).toBe(false)
  })

  it('空欄を null にする', () => {
    expect(optionalTime.parse('')).toBeNull()
  })
})

describe('optionalId', () => {
  it('選択された id をそのまま通す', () => {
    expect(optionalId.parse(3)).toBe(3)
  })

  it('未選択を null にする', () => {
    expect(optionalId.parse('')).toBeNull()
    expect(optionalId.parse(null)).toBeNull()
  })

  it('0 や負の値を弾く', () => {
    expect(optionalId.safeParse(0).success).toBe(false)
    expect(optionalId.safeParse(-1).success).toBe(false)
  })
})

describe('fieldErrors', () => {
  const schema = z.object({
    name: requiredText(5),
    url: optionalUrl,
  })

  it('項目名でエラー文を引ける形にする', () => {
    const result = schema.safeParse({ name: '', url: 'javascript:alert(1)' })
    expect(result.success).toBe(false)
    expect(fieldErrors(result.error as z.ZodError)).toEqual({
      name: MESSAGES.required,
      url: MESSAGES.url,
    })
  })

  it('1項目に複数のエラーが出ても最初の1件だけ残す', () => {
    const errors = fieldErrors(
      new z.ZodError([
        { code: 'custom', path: ['name'], message: '先の理由' },
        { code: 'custom', path: ['name'], message: '後の理由' },
      ]),
    )
    expect(errors).toEqual({ name: '先の理由' })
  })
})
