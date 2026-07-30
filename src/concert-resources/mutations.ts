import { and, asc, eq, gt, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { concertResources } from '../db/schema'
import {
  CONCERT_RESOURCE_LIMIT_MESSAGE,
  MAX_CONCERT_RESOURCES,
} from '../lib/limits'
import { type Direction, reorderRows } from '../lib/ordering'

export type ConcertResourceFields = {
  title: string
  url: string
}

export async function createConcertResource(
  db: Db,
  concertId: number,
  fields: ConcertResourceFields,
): Promise<void> {
  const now = new Date().toISOString()
  const inserted = await db.all<{ id: number }>(sql`
    insert into ${concertResources} (
      ${sql.identifier('concert_id')},
      ${sql.identifier('title')},
      ${sql.identifier('url')},
      ${sql.identifier('sort_order')},
      ${sql.identifier('created_at')},
      ${sql.identifier('updated_at')}
    )
    select
      ${concertId},
      ${fields.title},
      ${fields.url},
      coalesce(max(${concertResources.sortOrder}), -1) + 1,
      ${now},
      ${now}
    from ${concertResources}
    where ${concertResources.concertId} = ${concertId}
    having count(*) < ${MAX_CONCERT_RESOURCES}
    returning ${sql.identifier('id')}
  `)

  if (inserted.length === 0) throw new Error(CONCERT_RESOURCE_LIMIT_MESSAGE)
}

export async function updateConcertResource(
  db: Db,
  id: number,
  fields: ConcertResourceFields,
): Promise<void> {
  await db
    .update(concertResources)
    .set(fields)
    .where(eq(concertResources.id, id))
}

export async function moveConcertResource(
  db: Db,
  id: number,
  direction: Direction,
): Promise<void> {
  const [target] = await db
    .select({ concertId: concertResources.concertId })
    .from(concertResources)
    .where(eq(concertResources.id, id))
    .limit(1)
  if (!target) return

  const rows = await db
    .select({
      id: concertResources.id,
      sortOrder: concertResources.sortOrder,
    })
    .from(concertResources)
    .where(eq(concertResources.concertId, target.concertId))
    .orderBy(asc(concertResources.sortOrder), asc(concertResources.id))

  for (const row of reorderRows(rows, id, direction)) {
    await db
      .update(concertResources)
      .set({ sortOrder: row.sortOrder })
      .where(eq(concertResources.id, row.id))
  }
}

export async function deleteConcertResource(db: Db, id: number): Promise<void> {
  const [target] = await db
    .select({
      concertId: concertResources.concertId,
      sortOrder: concertResources.sortOrder,
    })
    .from(concertResources)
    .where(eq(concertResources.id, id))
    .limit(1)
  if (!target) return

  await db.delete(concertResources).where(eq(concertResources.id, id))
  await db
    .update(concertResources)
    .set({ sortOrder: sql`${concertResources.sortOrder} - 1` })
    .where(
      and(
        eq(concertResources.concertId, target.concertId),
        gt(concertResources.sortOrder, target.sortOrder),
      ),
    )
}
