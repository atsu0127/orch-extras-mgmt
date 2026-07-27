import { and, asc, desc, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client'
import { linkChecks, pieces } from '../db/schema'
import { type Direction, reorderRows } from '../lib/ordering'

export type PieceFields = {
  title: string
  composer: string | null
  bowingUrl: string | null
}

/** 演奏順の末尾に足す。プログラムは前から順に決まっていくことが多い */
export async function createPiece(
  db: Db,
  concertId: number,
  fields: PieceFields,
): Promise<void> {
  const [last] = await db
    .select({ sortOrder: pieces.sortOrder })
    .from(pieces)
    .where(eq(pieces.concertId, concertId))
    .orderBy(desc(pieces.sortOrder))
    .limit(1)

  await db
    .insert(pieces)
    .values({ concertId, ...fields, sortOrder: last ? last.sortOrder + 1 : 0 })
}

export async function updatePiece(
  db: Db,
  id: number,
  fields: PieceFields,
): Promise<void> {
  await db.update(pieces).set(fields).where(eq(pieces.id, id))

  // 別の URL に差し替えたなら、前の URL に対する検知結果は何も説明していないので捨てる。
  // 残すと直したリンクが管理トップに要確認として出続ける（ADR-0011）
  await db
    .delete(linkChecks)
    .where(
      and(
        eq(linkChecks.targetType, 'bowing'),
        eq(linkChecks.targetId, id),
        fields.bowingUrl === null
          ? undefined
          : ne(linkChecks.url, fields.bowingUrl),
      ),
    )
}

export async function movePiece(
  db: Db,
  id: number,
  direction: Direction,
): Promise<void> {
  const [target] = await db
    .select({ concertId: pieces.concertId })
    .from(pieces)
    .where(eq(pieces.id, id))
    .limit(1)
  if (!target) return

  const rows = await db
    .select({ id: pieces.id, sortOrder: pieces.sortOrder })
    .from(pieces)
    .where(eq(pieces.concertId, target.concertId))
    .orderBy(asc(pieces.sortOrder), asc(pieces.id))

  for (const row of reorderRows(rows, id, direction)) {
    await db
      .update(pieces)
      .set({ sortOrder: row.sortOrder })
      .where(eq(pieces.id, row.id))
  }
}

/**
 * 検知結果は消さない。id は再利用されないので別の曲の結果として読まれることはなく、
 * 孤児は Cron がまとめて掃除する（設計書9.5）
 */
export async function deletePiece(db: Db, id: number): Promise<void> {
  await db.delete(pieces).where(eq(pieces.id, id))
}
