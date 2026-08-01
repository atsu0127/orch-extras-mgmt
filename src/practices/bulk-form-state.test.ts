import { describe, expect, it } from 'vitest'
import {
  bulkPracticeCreateFormKey,
  collectBulkPracticesInput,
  createEmptyBulkPracticeRow,
  duplicateBulkPracticeRow,
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
      venueId: '',
    })
    expect(row.key).toMatch(/^bulk-row-/)
    expect(createEmptyBulkPracticeRow().key).not.toBe(row.key)
  })
})

describe('duplicateBulkPracticeRow', () => {
  it('内容をコピーし key だけ新しくする', () => {
    const source = {
      ...createEmptyBulkPracticeRow(),
      date: '2026-08-01',
      startTime: '19:00',
      endTime: '21:00',
      detail: '合奏',
      venueId: '3',
    }

    const copied = duplicateBulkPracticeRow(source)

    expect(copied).toMatchObject({
      date: '2026-08-01',
      startTime: '19:00',
      endTime: '21:00',
      detail: '合奏',
      venueId: '3',
    })
    expect(copied.key).not.toBe(source.key)
  })
})

describe('collectBulkPracticesInput', () => {
  it('venueId を送信形へ変換する', () => {
    const rows = [
      {
        ...createEmptyBulkPracticeRow(),
        date: '2026-08-01',
        venueId: '3',
      },
      {
        ...createEmptyBulkPracticeRow(),
        date: '2026-08-08',
        venueId: '',
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
          venueId: 3,
        },
        {
          date: '2026-08-08',
          startTime: '',
          endTime: '',
          detail: '',
          venueId: null,
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
