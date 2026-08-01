import { describe, expect, it } from 'vitest'
import {
  bulkPracticeCreateFormKey,
  collectBulkPracticesInput,
  createEmptyBulkPracticeRow,
  firstBulkValidationMessage,
} from './bulk-form-state'

describe('bulkPracticeCreateFormKey', () => {
  it('演奏会ごとに違う key を返し、一括フォームを作り直せる', () => {
    expect(bulkPracticeCreateFormKey(1)).toBe('1')
    expect(bulkPracticeCreateFormKey(2)).toBe('2')
    expect(bulkPracticeCreateFormKey(1)).not.toBe(bulkPracticeCreateFormKey(2))
  })
})

describe('createEmptyBulkPracticeRow', () => {
  it('未入力の1行を返す', () => {
    const row = createEmptyBulkPracticeRow()
    expect(row).toMatchObject({
      date: '',
      startTime: '',
      endTime: '',
      detail: '',
      venueMode: 'none',
      venueId: '',
      venueName: '',
      venueAddress: '',
      venueNote: '',
    })
    expect(row.key).toMatch(/^bulk-row-/)
    expect(createEmptyBulkPracticeRow().key).not.toBe(row.key)
  })
})

describe('collectBulkPracticesInput', () => {
  it('会場モードに応じて送信形へ変換する', () => {
    const rows = [
      {
        ...createEmptyBulkPracticeRow(),
        date: '2026-08-01',
        venueMode: 'existing' as const,
        venueId: '3',
      },
      {
        ...createEmptyBulkPracticeRow(),
        date: '2026-08-08',
        venueMode: 'new' as const,
        venueName: '新区民センター',
        venueAddress: '東京都',
      },
    ]

    expect(collectBulkPracticesInput(1, rows)).toEqual({
      concertId: 1,
      rows: [
        {
          date: '2026-08-01',
          startTime: '',
          endTime: '',
          detail: '',
          venue: { kind: 'existing', venueId: 3 },
        },
        {
          date: '2026-08-08',
          startTime: '',
          endTime: '',
          detail: '',
          venue: {
            kind: 'new',
            name: '新区民センター',
            address: '東京都',
            note: '',
          },
        },
      ],
    })
  })
})

describe('firstBulkValidationMessage', () => {
  it('行番号付きで最初のエラーを返す', () => {
    expect(
      firstBulkValidationMessage([
        { path: ['rows', 1, 'date'], message: '入力してください' },
      ]),
    ).toBe('2行目: 入力してください')
  })
})
