import { desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type ConcertStatus, concerts, venues } from '../db/schema'

export type ConcertOption = {
  id: number
  name: string
  performanceDate: string | null
  status: ConcertStatus
  createdAt: string
}

export type ConcertOverview = {
  id: number
  name: string
  performanceDate: string | null
  attendanceUrl: string | null
  attendanceNote: string | null
  venueName: string | null
  venueAddress: string | null
}

/**
 * セレクタと選択解決の両方がこれ1本で足りるように、必要な列だけを本番日の新しい順で返す。
 * 本番日が未設定のものは末尾に回す。
 */
export function listConcertOptions(db: Db): Promise<Array<ConcertOption>> {
  return db
    .select({
      id: concerts.id,
      name: concerts.name,
      performanceDate: concerts.performanceDate,
      status: concerts.status,
      createdAt: concerts.createdAt,
    })
    .from(concerts)
    .orderBy(
      sql`${concerts.performanceDate} is null`,
      desc(concerts.performanceDate),
      desc(concerts.id),
    )
}

export async function getConcertOverview(
  db: Db,
  concertId: number,
): Promise<ConcertOverview | null> {
  const [row] = await db
    .select({
      id: concerts.id,
      name: concerts.name,
      performanceDate: concerts.performanceDate,
      attendanceUrl: concerts.attendanceUrl,
      attendanceNote: concerts.attendanceNote,
      venueName: venues.name,
      venueAddress: venues.address,
    })
    .from(concerts)
    .leftJoin(venues, eq(concerts.venueId, venues.id))
    .where(eq(concerts.id, concertId))
    .limit(1)

  return row ?? null
}
