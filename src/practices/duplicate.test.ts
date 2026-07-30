import { describe, expect, expectTypeOf, it } from 'vitest'
import { duplicatePracticeValues } from './duplicate'
import type { PracticeAdminItem } from './queries'

const source: PracticeAdminItem = {
  id: 12,
  date: '2026-07-30',
  startTime: '18:30',
  endTime: '21:00',
  venueId: 3,
  detail: '合奏',
  media: [
    {
      id: 45,
      title: '通し録音',
      url: 'https://example.com/recording',
    },
  ],
}

describe('duplicatePracticeValues', () => {
  it('日付と元レコード固有の情報を除いてフォーム値へ引き継ぐ', () => {
    const values = duplicatePracticeValues(source)

    expectTypeOf(values).toEqualTypeOf<{
      date: string
      startTime: string
      endTime: string
      venueId: string
      detail: string
    }>()
    expect(values).toEqual({
      date: '',
      startTime: '18:30',
      endTime: '21:00',
      venueId: '3',
      detail: '合奏',
    })
    expect(Object.keys(values)).not.toContain('id')
    expect(Object.keys(values)).not.toContain('media')
    expect(Object.keys(values)).not.toContain('concertId')
  })

  it('nullableな項目を空文字へ変換する', () => {
    expect(
      duplicatePracticeValues({
        ...source,
        startTime: null,
        endTime: null,
        venueId: null,
        detail: null,
      }),
    ).toEqual({
      date: '',
      startTime: '',
      endTime: '',
      venueId: '',
      detail: '',
    })
  })
})
