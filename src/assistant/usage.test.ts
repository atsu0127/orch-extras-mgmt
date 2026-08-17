import { getTableColumns } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db/client'
import { aiUsageDaily } from '../db/schema'
import { ASSISTANT_MODEL } from '../lib/assistant'
import { createTestDb } from '../test/db'
import { listDailyUsage, recordDailyUsage } from './usage'

let db: Db

beforeEach(() => {
  db = createTestDb()
})

describe('recordDailyUsage', () => {
  it('UTC の日付とモデルを主キーに加算する', async () => {
    const now = new Date('2026-08-17T15:30:00.000Z')

    await recordDailyUsage(
      db,
      {
        apiRequestCount: 2,
        successfulQuestionCount: 1,
        failedQuestionCount: 0,
        inputTokens: 100,
        outputTokens: 40,
      },
      now,
    )
    await recordDailyUsage(
      db,
      {
        apiRequestCount: 1,
        successfulQuestionCount: 0,
        failedQuestionCount: 1,
        inputTokens: 50,
        outputTokens: 0,
      },
      now,
    )

    const rows = await listDailyUsage(db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      usageDate: '2026-08-17',
      model: ASSISTANT_MODEL,
      apiRequestCount: 3,
      successfulQuestionCount: 1,
      failedQuestionCount: 1,
      inputTokens: 150,
      outputTokens: 40,
    })
  })

  it('質問本文や回答本文を保存しない', async () => {
    const question = '次の練習はいつですか？秘密の質問'
    const answer = '登録情報にありません。秘密の回答'

    await recordDailyUsage(db, {
      apiRequestCount: 2,
      successfulQuestionCount: 1,
      failedQuestionCount: 0,
      inputTokens: 10,
      outputTokens: 5,
    })

    const columns = Object.keys(getTableColumns(aiUsageDaily))
    expect(columns).not.toEqual(expect.arrayContaining(['question', 'answer']))

    const dumped = JSON.stringify(await listDailyUsage(db))
    expect(dumped).not.toContain(question)
    expect(dumped).not.toContain(answer)
  })
})
