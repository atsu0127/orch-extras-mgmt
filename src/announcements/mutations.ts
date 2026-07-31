import { eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { announcements } from '../db/schema'
import { ANNOUNCEMENT_LIMIT_MESSAGE, MAX_ANNOUNCEMENTS } from '../lib/limits'
import type { AnnouncementFields } from './input'

export async function createAnnouncement(
  db: Db,
  concertId: number,
  fields: AnnouncementFields,
): Promise<void> {
  const now = new Date().toISOString()
  const inserted = await db.all<{ id: number }>(sql`
    insert into ${announcements} (
      ${sql.identifier('concert_id')},
      ${sql.identifier('title')},
      ${sql.identifier('body')},
      ${sql.identifier('url')},
      ${sql.identifier('created_at')},
      ${sql.identifier('updated_at')}
    )
    select
      ${concertId},
      ${fields.title},
      ${fields.body},
      ${fields.url},
      ${now},
      ${now}
    where (
      select count(*) from ${announcements}
      where ${announcements.concertId} = ${concertId}
    ) < ${MAX_ANNOUNCEMENTS}
    returning ${sql.identifier('id')}
  `)

  if (inserted.length === 0) throw new Error(ANNOUNCEMENT_LIMIT_MESSAGE)
}

export async function updateAnnouncement(
  db: Db,
  id: number,
  fields: AnnouncementFields,
): Promise<void> {
  await db
    .update(announcements)
    .set({
      title: fields.title,
      body: fields.body,
      url: fields.url,
    })
    .where(eq(announcements.id, id))
}

export async function deleteAnnouncement(db: Db, id: number): Promise<void> {
  await db.delete(announcements).where(eq(announcements.id, id))
}
