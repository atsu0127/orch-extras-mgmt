import type { z } from 'zod'
import { toOptionalId } from '../lib/validation'
import type { bulkPracticesInput } from './bulk-input'

export type BulkPracticesFormValue = z.input<typeof bulkPracticesInput>

/** 演奏会を切り替えたとき一括フォームの入力を残さない（AGENTS.md） */
export function bulkPracticeCreateFormKey(concertId: number): string {
  return String(concertId)
}

export type BulkVenueMode = 'none' | 'existing' | 'new'

export type BulkPracticeRowDraft = {
  key: string
  date: string
  startTime: string
  endTime: string
  detail: string
  venueMode: BulkVenueMode
  venueId: string
  venueName: string
  venueAddress: string
  venueNote: string
}

let bulkRowKeySeq = 0

export function createEmptyBulkPracticeRow(): BulkPracticeRowDraft {
  bulkRowKeySeq += 1
  return {
    key: `bulk-row-${bulkRowKeySeq}`,
    date: '',
    startTime: '',
    endTime: '',
    detail: '',
    venueMode: 'none',
    venueId: '',
    venueName: '',
    venueAddress: '',
    venueNote: '',
  }
}

/** フォーム state をサーバ関数と同じ形へ寄せる */
export function collectBulkPracticesInput(
  concertId: number,
  rows: ReadonlyArray<BulkPracticeRowDraft>,
): BulkPracticesFormValue {
  return {
    concertId,
    rows: rows.map((row) => ({
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      detail: row.detail,
      venue: collectVenue(row),
    })),
  }
}

function collectVenue(row: BulkPracticeRowDraft) {
  if (row.venueMode === 'existing') {
    return {
      kind: 'existing' as const,
      venueId: toOptionalId(row.venueId) ?? 0,
    }
  }
  if (row.venueMode === 'new') {
    return {
      kind: 'new' as const,
      name: row.venueName,
      address: row.venueAddress,
      note: row.venueNote,
    }
  }
  return { kind: 'none' as const }
}

export function firstBulkValidationMessage(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): string {
  const issue = issues[0]
  if (!issue) return '入力内容を確認してください'

  if (issue.path[0] === 'rows' && typeof issue.path[1] === 'number') {
    return `${issue.path[1] + 1}行目: ${issue.message}`
  }
  return issue.message
}
