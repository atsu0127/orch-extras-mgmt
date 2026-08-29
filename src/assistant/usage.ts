import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { aiUsageDaily } from '../db/schema'
import { ASSISTANT_MODEL } from '../lib/assistant'
import { todayInJst } from '../lib/date'

export type UsageDelta = {
  apiRequestCount: number
  successfulQuestionCount: number
  failedQuestionCount: number
  inputTokens: number
  outputTokens: number
}

/**
 * 日別集計だけを加算する。質問・回答・利用者は列に持たない。
 * 失敗しても呼び出し側で握りつぶし、生成済みの回答は落とさない。
 */
export async function recordDailyUsage(
  db: Db,
  delta: UsageDelta,
  now: Date = new Date(),
  model: string = ASSISTANT_MODEL,
): Promise<void> {
  const usageDate = todayInJst(now)
  const updatedAt = now.toISOString()

  await db
    .insert(aiUsageDaily)
    .values({
      usageDate,
      model,
      apiRequestCount: delta.apiRequestCount,
      successfulQuestionCount: delta.successfulQuestionCount,
      failedQuestionCount: delta.failedQuestionCount,
      inputTokens: delta.inputTokens,
      outputTokens: delta.outputTokens,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [aiUsageDaily.usageDate, aiUsageDaily.model],
      set: {
        apiRequestCount: sql`${aiUsageDaily.apiRequestCount} + ${delta.apiRequestCount}`,
        successfulQuestionCount: sql`${aiUsageDaily.successfulQuestionCount} + ${delta.successfulQuestionCount}`,
        failedQuestionCount: sql`${aiUsageDaily.failedQuestionCount} + ${delta.failedQuestionCount}`,
        inputTokens: sql`${aiUsageDaily.inputTokens} + ${delta.inputTokens}`,
        outputTokens: sql`${aiUsageDaily.outputTokens} + ${delta.outputTokens}`,
        updatedAt,
      },
    })
}

export function listDailyUsage(db: Db) {
  return db.select().from(aiUsageDaily)
}
