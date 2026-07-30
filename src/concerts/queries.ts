import { countDistinct, desc, eq, sql } from 'drizzle-orm'
import { listConcertResourcesByConcert } from '../concert-resources/queries'
import type { Db } from '../db/client'
import {
  type ConcertResource,
  type ConcertStatus,
  concerts,
  pieces,
  practices,
  venues,
} from '../db/schema'

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
  note: string | null
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

export type ConcertAdminItem = {
  id: number
  name: string
  performanceDate: string | null
  venueId: number | null
  attendanceUrl: string | null
  attendanceNote: string | null
  note: string | null
  status: ConcertStatus
  /** 削除すると一緒に消える配下の件数。確認ダイアログの警告に使う */
  practiceCount: number
  pieceCount: number
  resourceCount: number
  resources: Array<ConcertResource>
}

/** 管理画面の一覧。並びはセレクタと同じにして、探す場所を変えずに済むようにする */
export async function listConcertsForAdmin(
  db: Db,
): Promise<Array<ConcertAdminItem>> {
  const rows = await db
    .select({
      id: concerts.id,
      name: concerts.name,
      performanceDate: concerts.performanceDate,
      venueId: concerts.venueId,
      attendanceUrl: concerts.attendanceUrl,
      attendanceNote: concerts.attendanceNote,
      note: concerts.note,
      status: concerts.status,
      // join を2本重ねると行が掛け算になるので、distinct で数える
      practiceCount: countDistinct(practices.id),
      pieceCount: countDistinct(pieces.id),
    })
    .from(concerts)
    .leftJoin(practices, eq(practices.concertId, concerts.id))
    .leftJoin(pieces, eq(pieces.concertId, concerts.id))
    .groupBy(concerts.id)
    .orderBy(
      sql`${concerts.performanceDate} is null`,
      desc(concerts.performanceDate),
      desc(concerts.id),
    )

  const resources = await listConcertResourcesByConcert(
    db,
    rows.map(({ id }) => id),
  )
  return rows.map((row) => {
    const concertResourceItems = resources.get(row.id) ?? []
    return {
      ...row,
      resourceCount: concertResourceItems.length,
      resources: concertResourceItems,
    }
  })
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
      note: concerts.note,
      venueName: venues.name,
      venueAddress: venues.address,
    })
    .from(concerts)
    .leftJoin(venues, eq(concerts.venueId, venues.id))
    .where(eq(concerts.id, concertId))
    .limit(1)

  return row ?? null
}
