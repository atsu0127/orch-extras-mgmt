import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { type Announcement, announcements } from '../db/schema'

export function listAnnouncementsForConcert(
  db: Db,
  concertId: number,
): Promise<Array<Announcement>> {
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.concertId, concertId))
    .orderBy(desc(announcements.createdAt), desc(announcements.id))
}
