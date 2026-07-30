import { describe, expect, it } from 'vitest'
import { concertInput } from './input'

const base = {
  name: '定期演奏会',
  performanceDate: '',
  venueId: null,
  attendanceUrl: '',
  attendanceNote: '',
  note: '',
}

describe('concertInput', () => {
  it('備考の改行を保持する', () => {
    const note = '集合 17:00\n服装 黒'

    expect(concertInput.parse({ ...base, note }).note).toBe(note)
  })

  it('空欄の備考を null にする', () => {
    expect(concertInput.parse({ ...base, note: '' }).note).toBeNull()
  })

  it('2001文字の備考を拒否する', () => {
    const result = concertInput.safeParse({ ...base, note: 'あ'.repeat(2001) })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['note'])
  })
})
