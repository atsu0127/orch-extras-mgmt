import { asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { practiceMedia, practices } from '../db/schema'
import { type Direction, reorderRows } from '../lib/ordering'

export type PracticeFields = {
  date: string
  startTime: string | null
  endTime: string | null
  venueId: number | null
  detail: string | null
}

export async function createPractice(
  db: Db,
  concertId: number,
  fields: PracticeFields,
): Promise<void> {
  await db.insert(practices).values({ concertId, ...fields })
}

/** 所属する演奏会は変えられない。付いている録音リンクごと移ることになり、意図しにくい */
export async function updatePractice(
  db: Db,
  id: number,
  fields: PracticeFields,
): Promise<void> {
  await db.update(practices).set(fields).where(eq(practices.id, id))
}

/** 付いている録音リンクも一緒に消える（設計書6.2 の CASCADE） */
export async function deletePractice(db: Db, id: number): Promise<void> {
  await db.delete(practices).where(eq(practices.id, id))
}

export type PracticeMediaFields = {
  title: string
  url: string
}

/** 末尾に足す。録音は録った順に並べるのが自然で、足すたびに並べ替えずに済む */
export async function createPracticeMedia(
  db: Db,
  practiceId: number,
  fields: PracticeMediaFields,
): Promise<void> {
  const [last] = await db
    .select({ sortOrder: practiceMedia.sortOrder })
    .from(practiceMedia)
    .where(eq(practiceMedia.practiceId, practiceId))
    .orderBy(desc(practiceMedia.sortOrder))
    .limit(1)

  await db
    .insert(practiceMedia)
    .values({ practiceId, ...fields, sortOrder: last ? last.sortOrder + 1 : 0 })
}

export async function movePracticeMedia(
  db: Db,
  id: number,
  direction: Direction,
): Promise<void> {
  const [target] = await db
    .select({ practiceId: practiceMedia.practiceId })
    .from(practiceMedia)
    .where(eq(practiceMedia.id, id))
    .limit(1)
  if (!target) return

  const rows = await db
    .select({ id: practiceMedia.id, sortOrder: practiceMedia.sortOrder })
    .from(practiceMedia)
    .where(eq(practiceMedia.practiceId, target.practiceId))
    .orderBy(asc(practiceMedia.sortOrder), asc(practiceMedia.id))

  for (const row of reorderRows(rows, id, direction)) {
    await db
      .update(practiceMedia)
      .set({ sortOrder: row.sortOrder })
      .where(eq(practiceMedia.id, row.id))
  }
}

/**
 * 抜けた分の詰め直しはしない。並びは `sort_order` の順序だけで決まるので、
 * 番号が飛んでいても見え方は変わらない
 */
export async function deletePracticeMedia(db: Db, id: number): Promise<void> {
  await db.delete(practiceMedia).where(eq(practiceMedia.id, id))
}
