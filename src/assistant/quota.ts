import { and, count, eq, gte, lt, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { aiAskAttempts, aiUsageDaily } from '../db/schema'
import { ASSISTANT_LIMITS, ASSISTANT_MODEL } from '../lib/assistant'
import { todayInJst } from '../lib/date'

export type AssistantQuotaDecision = 'ok' | 'ip_limited' | 'daily_limited'

const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000

/**
 * Claude を呼ぶ直前に枠を確保する。COUNT → 日次の条件付き upsert → IP INSERT。
 * 日次は WHERE accepted < 80 付きなので同時リクエストでも 80 を超えない。
 */
export async function reserveAssistantQuota(
  db: Db,
  options: { ip: string; now: Date },
): Promise<AssistantQuotaDecision> {
  const nowIso = options.now.toISOString()
  const windowStart = new Date(
    options.now.getTime() - ASSISTANT_LIMITS.ipWindowMs,
  ).toISOString()

  const [taken] = await db
    .select({ count: count() })
    .from(aiAskAttempts)
    .where(
      and(
        eq(aiAskAttempts.ip, options.ip),
        gte(aiAskAttempts.attemptedAt, windowStart),
      ),
    )

  if ((taken?.count ?? 0) >= ASSISTANT_LIMITS.ipQuestionsMax) {
    return 'ip_limited'
  }

  const usageDate = todayInJst(options.now)
  const reserved = await db
    .insert(aiUsageDaily)
    .values({
      usageDate,
      model: ASSISTANT_MODEL,
      acceptedQuestionCount: 1,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: [aiUsageDaily.usageDate, aiUsageDaily.model],
      set: {
        acceptedQuestionCount: sql`${aiUsageDaily.acceptedQuestionCount} + 1`,
        updatedAt: nowIso,
      },
      where: sql`${aiUsageDaily.acceptedQuestionCount} < ${ASSISTANT_LIMITS.dailyQuestionsMax}`,
    })
    .returning({ accepted: aiUsageDaily.acceptedQuestionCount })

  if (reserved.length === 0) return 'daily_limited'

  await db.insert(aiAskAttempts).values({
    ip: options.ip,
    attemptedAt: nowIso,
  })

  try {
    const cutoff = new Date(
      options.now.getTime() - ATTEMPT_RETENTION_MS,
    ).toISOString()
    await db.delete(aiAskAttempts).where(lt(aiAskAttempts.attemptedAt, cutoff))
  } catch {
    // 掃除失敗では Claude を止めない
  }

  return 'ok'
}
