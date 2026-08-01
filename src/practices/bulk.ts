import { eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client'
import { concerts, practices, venues } from '../db/schema'
import {
  BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE,
} from '../lib/limits'
import type { BulkPracticeRowInput } from './bulk-input'

export type BulkCreateResult = {
  practiceCount: number
}

/**
 * 選択中演奏会へ練習をまとめて追加する。会場は既存 ID または未設定のみ
 * （docs/practice-bulk-create/design.md）。
 */
export async function createPracticesBulk(
  db: Db,
  concertId: number,
  rows: ReadonlyArray<BulkPracticeRowInput>,
): Promise<BulkCreateResult> {
  const [concert] = await db
    .select({ id: concerts.id })
    .from(concerts)
    .where(eq(concerts.id, concertId))
    .limit(1)
  if (!concert) {
    throw new Error(BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE)
  }

  const existingIds = [
    ...new Set(
      rows.flatMap((row) => (row.venueId === null ? [] : [row.venueId])),
    ),
  ]
  if (existingIds.length > 0) {
    const found = await db
      .select({ id: venues.id })
      .from(venues)
      .where(inArray(venues.id, existingIds))
    if (found.length !== existingIds.length) {
      throw new Error(BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE)
    }
  }

  await db.insert(practices).values(
    rows.map((row) => ({
      concertId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      detail: row.detail,
      venueId: row.venueId,
    })),
  )

  return { practiceCount: rows.length }
}
