import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { practices } from '../db/schema'

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
