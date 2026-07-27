import { asc, countDistinct, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { concerts, practices, venues } from '../db/schema'

export type VenueListItem = {
  id: number
  name: string
  address: string
  note: string | null
  /** この会場を使っている練習と演奏会の件数。削除する前に影響が分かるようにする */
  practiceCount: number
  concertCount: number
}

export type VenueOption = {
  id: number
  name: string
}

/** 同じ施設の部屋違いが並ぶので名前順にする。件数も join で1クエリに収める */
export function listVenues(db: Db): Promise<Array<VenueListItem>> {
  return db
    .select({
      id: venues.id,
      name: venues.name,
      address: venues.address,
      note: venues.note,
      // join を2本重ねると行が掛け算になるので、distinct で数える
      practiceCount: countDistinct(practices.id),
      concertCount: countDistinct(concerts.id),
    })
    .from(venues)
    .leftJoin(practices, eq(practices.venueId, venues.id))
    .leftJoin(concerts, eq(concerts.venueId, venues.id))
    .groupBy(venues.id)
    .orderBy(asc(venues.name), asc(venues.id))
}

/** 練習や演奏会の会場を選ぶセレクタ用 */
export function listVenueOptions(db: Db): Promise<Array<VenueOption>> {
  return db
    .select({ id: venues.id, name: venues.name })
    .from(venues)
    .orderBy(asc(venues.name), asc(venues.id))
}
