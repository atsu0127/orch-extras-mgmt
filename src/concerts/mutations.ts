import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type ConcertStatus, concerts } from '../db/schema'

export type ConcertInput = {
  name: string
  performanceDate: string | null
  venueId: number | null
  attendanceUrl: string | null
  attendanceNote: string | null
  note: string | null
}

type ConcertInputWithoutNote = Omit<ConcertInput, 'note'>

function withNote(input: ConcertInput | ConcertInputWithoutNote): ConcertInput {
  return 'note' in input ? input : { ...input, note: null }
}

export async function createConcert(
  db: Db,
  input: ConcertInput | ConcertInputWithoutNote,
): Promise<void> {
  await db.insert(concerts).values(withNote(input))
}

export async function updateConcert(
  db: Db,
  id: number,
  input: ConcertInput | ConcertInputWithoutNote,
): Promise<void> {
  await db.update(concerts).set(input).where(eq(concerts.id, id))
}

/**
 * アーカイブは削除の代わりに使う。終わった演奏会もセレクタから選べる状態で残す。
 */
export async function setConcertStatus(
  db: Db,
  id: number,
  status: ConcertStatus,
): Promise<void> {
  await db.update(concerts).set({ status }).where(eq(concerts.id, id))
}

/** 配下の練習・録音リンク・曲・資料も一緒に消える（設計書6.2 の CASCADE） */
export async function deleteConcert(db: Db, id: number): Promise<void> {
  await db.delete(concerts).where(eq(concerts.id, id))
}
