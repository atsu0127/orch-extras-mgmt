import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import type { Db } from '../db/client'
import { practiceMedia, practices, venues } from '../db/schema'

export type PracticeVenue = {
  name: string
  address: string
  note: string | null
}

export type PracticeMediaLink = {
  id: number
  title: string
  url: string
}

export type PracticeEntry = {
  id: number
  date: string
  startTime: string | null
  endTime: string | null
  detail: string | null
  venue: PracticeVenue | null
  media: Array<PracticeMediaLink>
}

const practiceColumns = {
  id: practices.id,
  date: practices.date,
  startTime: practices.startTime,
  endTime: practices.endTime,
  detail: practices.detail,
  venueName: venues.name,
  venueAddress: venues.address,
  venueNote: venues.note,
}

/** leftJoin なので会場側の列だけが null になり得る */
type PracticeRow = {
  id: number
  date: string
  startTime: string | null
  endTime: string | null
  detail: string | null
  venueName: string | null
  venueAddress: string | null
  venueNote: string | null
}

/** 今日以降で最も早い1件。同じ日なら開始時刻の早い順 */
export async function getNextPractice(
  db: Db,
  concertId: number,
  today: string,
): Promise<PracticeEntry | null> {
  const [row] = await db
    .select(practiceColumns)
    .from(practices)
    .leftJoin(venues, eq(practices.venueId, venues.id))
    .where(and(eq(practices.concertId, concertId), gte(practices.date, today)))
    .orderBy(asc(practices.date), asc(practices.startTime), asc(practices.id))
    .limit(1)

  if (!row) return null

  const media = await listMediaByPractice(db, [row.id])
  return toEntry(row, media)
}

/** 演奏会に属する練習を日付順に。録音は1クエリでまとめて引く */
export async function listPracticesWithMedia(
  db: Db,
  concertId: number,
): Promise<Array<PracticeEntry>> {
  const rows = await db
    .select(practiceColumns)
    .from(practices)
    .leftJoin(venues, eq(practices.venueId, venues.id))
    .where(eq(practices.concertId, concertId))
    .orderBy(asc(practices.date), asc(practices.startTime), asc(practices.id))

  if (rows.length === 0) return []

  const media = await listMediaByPractice(
    db,
    rows.map((row) => row.id),
  )
  return rows.map((row) => toEntry(row, media))
}

export type PracticeAdminItem = {
  id: number
  date: string
  startTime: string | null
  endTime: string | null
  venueId: number | null
  detail: string | null
}

/**
 * 管理画面の一覧。会場は id だけ返す。名前は会場の選択肢から引けるので、
 * join を1つ減らせる（設計書5.3のサブリクエスト上限）
 */
export async function listPracticesForAdmin(
  db: Db,
  concertId: number,
): Promise<Array<PracticeAdminItem>> {
  return db
    .select({
      id: practices.id,
      date: practices.date,
      startTime: practices.startTime,
      endTime: practices.endTime,
      venueId: practices.venueId,
      detail: practices.detail,
    })
    .from(practices)
    .where(eq(practices.concertId, concertId))
    .orderBy(asc(practices.date), asc(practices.startTime), asc(practices.id))
}

async function listMediaByPractice(
  db: Db,
  practiceIds: ReadonlyArray<number>,
): Promise<Map<number, Array<PracticeMediaLink>>> {
  const rows = await db
    .select({
      practiceId: practiceMedia.practiceId,
      id: practiceMedia.id,
      title: practiceMedia.title,
      url: practiceMedia.url,
    })
    .from(practiceMedia)
    .where(inArray(practiceMedia.practiceId, [...practiceIds]))
    .orderBy(asc(practiceMedia.sortOrder), asc(practiceMedia.id))

  const grouped = new Map<number, Array<PracticeMediaLink>>()
  for (const { practiceId, ...link } of rows) {
    const links = grouped.get(practiceId)
    if (links) links.push(link)
    else grouped.set(practiceId, [link])
  }
  return grouped
}

function toEntry(
  row: PracticeRow,
  media: Map<number, Array<PracticeMediaLink>>,
): PracticeEntry {
  return {
    id: row.id,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    detail: row.detail,
    venue:
      row.venueName === null || row.venueAddress === null
        ? null
        : {
            name: row.venueName,
            address: row.venueAddress,
            note: row.venueNote,
          },
    media: media.get(row.id) ?? [],
  }
}
