import { describe, expect, it } from 'vitest'
import { practiceInput } from './input'

const base = {
  date: '2026-09-01',
  startTime: '',
  endTime: '',
  venueId: null,
  detail: '',
}

describe('practiceInput', () => {
  it('日付だけあれば通り、空欄は null になる', () => {
    const parsed = practiceInput.parse(base)

    expect(parsed).toEqual({
      date: '2026-09-01',
      startTime: null,
      endTime: null,
      venueId: null,
      detail: null,
    })
  })

  it('開始と終了が前後していたら終了時刻の側で弾く', () => {
    const result = practiceInput.safeParse({
      ...base,
      startTime: '21:00',
      endTime: '19:00',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['endTime'])
  })

  it('開始と終了が同じ時刻も弾く', () => {
    const result = practiceInput.safeParse({
      ...base,
      startTime: '19:00',
      endTime: '19:00',
    })

    expect(result.success).toBe(false)
  })

  it('時刻は片方だけでも通る', () => {
    expect(
      practiceInput.safeParse({ ...base, startTime: '19:00' }).success,
    ).toBe(true)
    expect(practiceInput.safeParse({ ...base, endTime: '21:00' }).success).toBe(
      true,
    )
  })
})
