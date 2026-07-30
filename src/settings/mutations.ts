import type { Db } from '../db/client'
import { appSettings } from '../db/schema'

export async function updateAdminEmail(
  db: Db,
  adminEmail: string | null,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: 1, adminEmail })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { adminEmail, updatedAt: new Date().toISOString() },
    })
}
