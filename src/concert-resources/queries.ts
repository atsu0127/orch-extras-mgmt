import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type ConcertResource, concertResources } from '../db/schema'

export function listConcertResources(
  db: Db,
  concertId: number,
): Promise<Array<ConcertResource>> {
  return db
    .select()
    .from(concertResources)
    .where(eq(concertResources.concertId, concertId))
    .orderBy(asc(concertResources.sortOrder), asc(concertResources.id))
}

export async function listConcertResourcesByConcert(
  db: Db,
  concertIds: readonly number[],
): Promise<Map<number, Array<ConcertResource>>> {
  if (concertIds.length === 0) return new Map()

  const requestedIds = new Set(concertIds)
  const rows = await db
    .select()
    .from(concertResources)
    .orderBy(
      asc(concertResources.concertId),
      asc(concertResources.sortOrder),
      asc(concertResources.id),
    )

  const grouped = new Map<number, Array<ConcertResource>>()
  for (const row of rows) {
    if (!requestedIds.has(row.concertId)) continue
    const resources = grouped.get(row.concertId)
    if (resources) resources.push(row)
    else grouped.set(row.concertId, [row])
  }
  return grouped
}
