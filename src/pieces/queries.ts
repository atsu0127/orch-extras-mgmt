import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { pieces } from '../db/schema'

export type PieceEntry = {
  id: number
  title: string
  composer: string | null
  bowingUrl: string | null
  scoreWithoutBowingUrl: string | null
}

/** 演奏順（sort_order）に並べる。同じ順序が入っていたら登録順で決める */
export function listPiecesForConcert(
  db: Db,
  concertId: number,
): Promise<Array<PieceEntry>> {
  return db
    .select({
      id: pieces.id,
      title: pieces.title,
      composer: pieces.composer,
      bowingUrl: pieces.bowingUrl,
      scoreWithoutBowingUrl: pieces.scoreWithoutBowingUrl,
    })
    .from(pieces)
    .where(eq(pieces.concertId, concertId))
    .orderBy(asc(pieces.sortOrder), asc(pieces.id))
}
