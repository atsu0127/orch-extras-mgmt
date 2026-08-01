import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { venues } from '../db/schema'

export type VenueInput = {
  name: string
  address: string
  note: string | null
}

export async function createVenue(db: Db, input: VenueInput): Promise<number> {
  const [created] = await db
    .insert(venues)
    .values(input)
    .returning({ id: venues.id })
  if (!created) {
    throw new Error('会場を登録できませんでした')
  }
  return created.id
}

export async function updateVenue(
  db: Db,
  id: number,
  input: VenueInput,
): Promise<void> {
  await db.update(venues).set(input).where(eq(venues.id, id))
}

/**
 * 会場を消しても練習と演奏会は残り、会場が未設定になる（設計書6.2）。
 * 過去の練習記録を失わないための挙動なので、参照があっても削除を止めない。
 */
export async function deleteVenue(db: Db, id: number): Promise<void> {
  await db.delete(venues).where(eq(venues.id, id))
}
