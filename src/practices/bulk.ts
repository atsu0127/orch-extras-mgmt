import { eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client'
import { concerts, practices, venues } from '../db/schema'
import {
  BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE,
  BULK_PRACTICE_VENUE_ADDRESS_CONFLICT_MESSAGE,
} from '../lib/limits'
import type { BulkPracticeRowInput } from './bulk-input'

export type BulkCreateResult = {
  practiceCount: number
  venueCreatedCount: number
}

type NewVenueDraft = {
  name: string
  address: string
  note: string | null
}

/**
 * 選択中演奏会へ練習をまとめて追加する。会場の新規は未登録名だけ INSERT し、
 * 同名は再利用する（docs/practice-bulk-create/design.md）。
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
      rows.flatMap((row) =>
        row.venue.kind === 'existing' ? [row.venue.venueId] : [],
      ),
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

  const newDrafts = collectNewVenueDrafts(rows)
  const newNames = [...newDrafts.keys()]
  const nameToVenueId = new Map<string, number>()

  let venueCreatedCount = 0
  if (newNames.length > 0) {
    const existingByName = await db
      .select({ id: venues.id, name: venues.name })
      .from(venues)
      .where(inArray(venues.name, newNames))

    for (const venue of existingByName) {
      if (!nameToVenueId.has(venue.name)) {
        nameToVenueId.set(venue.name, venue.id)
      }
    }

    const toCreate = [...newDrafts.values()].filter(
      (draft) => !nameToVenueId.has(draft.name),
    )
    if (toCreate.length > 0) {
      await db.insert(venues).values(toCreate)
      const created = await db
        .select({ id: venues.id, name: venues.name })
        .from(venues)
        .where(
          inArray(
            venues.name,
            toCreate.map((draft) => draft.name),
          ),
        )
      for (const venue of created) {
        if (!nameToVenueId.has(venue.name)) {
          nameToVenueId.set(venue.name, venue.id)
        }
      }
      venueCreatedCount = toCreate.length
    }
  }

  const practiceValues = rows.map((row) => ({
    concertId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    detail: row.detail,
    venueId: resolveVenueId(row, nameToVenueId),
  }))

  await db.insert(practices).values(practiceValues)

  return {
    practiceCount: rows.length,
    venueCreatedCount,
  }
}

function collectNewVenueDrafts(
  rows: ReadonlyArray<BulkPracticeRowInput>,
): Map<string, NewVenueDraft> {
  const drafts = new Map<string, NewVenueDraft>()

  for (const row of rows) {
    if (row.venue.kind !== 'new') continue
    const current = drafts.get(row.venue.name)
    if (!current) {
      drafts.set(row.venue.name, {
        name: row.venue.name,
        address: row.venue.address,
        note: row.venue.note,
      })
      continue
    }
    if (current.address !== row.venue.address) {
      throw new Error(BULK_PRACTICE_VENUE_ADDRESS_CONFLICT_MESSAGE)
    }
  }

  return drafts
}

function resolveVenueId(
  row: BulkPracticeRowInput,
  nameToVenueId: ReadonlyMap<string, number>,
): number | null {
  if (row.venue.kind === 'none') return null
  if (row.venue.kind === 'existing') return row.venue.venueId

  const id = nameToVenueId.get(row.venue.name)
  if (id === undefined) {
    throw new Error(BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE)
  }
  return id
}
