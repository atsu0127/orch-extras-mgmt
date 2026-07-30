import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { appSettings } from '../db/schema'

export type AppSettingsView = {
  adminEmail: string | null
}

export async function getAppSettings(db: Db): Promise<AppSettingsView> {
  const [row] = await db
    .select({ adminEmail: appSettings.adminEmail })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1)

  return row ?? { adminEmail: null }
}
