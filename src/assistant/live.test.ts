import { describe, expect, it } from 'vitest'
import { concerts, practices } from '../db/schema'
import { ASSISTANT_MODEL } from '../lib/assistant'
import { createTestDb } from '../test/db'
import { createAnthropicClient } from './anthropic-client'
import { answerQuestion } from './loop'
import { listDailyUsage } from './usage'

const live =
  process.env.ASSISTANT_LIVE === '1' && Boolean(process.env.ANTHROPIC_API_KEY)

describe.skipIf(!live)('実 Claude API', () => {
  it('代表質問・別演奏会・登録なしを回答し、利用量を残す', async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定')
    const db = createTestDb()
    await db.insert(concerts).values([
      {
        id: 1,
        name: '第10回定期演奏会',
        attendanceUrl: 'https://example.com/attendance',
      },
      {
        id: 2,
        name: '室内楽の夕べ',
        attendanceUrl: 'https://example.com/chamber',
      },
    ])
    await db.insert(practices).values({
      id: 1,
      concertId: 1,
      date: '2026-08-10',
      detail: '弦分奏',
    })

    const client = createAnthropicClient(apiKey)
    const representative = await answerQuestion({
      db,
      client,
      input: {
        question: '次の練習はいつですか？',
        selectedConcertId: 1,
        history: [],
      },
    })
    expect(representative.ok).toBe(true)
    if (representative.ok) {
      expect(representative.answer).toMatch(/8月10日|08-10|弦分奏/)
      expect(representative.links.length).toBeGreaterThan(0)
    }

    const other = await answerQuestion({
      db,
      client,
      input: {
        question: '演奏会「室内楽の夕べ」の出欠はどこですか？',
        selectedConcertId: 1,
        history: [],
      },
    })
    expect(other.ok).toBe(true)
    if (other.ok) {
      expect(other.concertName).toBe('室内楽の夕べ')
    }

    const missing = await answerQuestion({
      db,
      client,
      input: {
        question: 'ケータリングのメニューは何ですか？',
        selectedConcertId: 1,
        history: [],
      },
    })
    expect(missing.ok).toBe(true)
    if (missing.ok) {
      expect(missing.answer).toContain('登録情報にありません')
    }

    const usage = await listDailyUsage(db)
    const row = usage.find((item) => item.model === ASSISTANT_MODEL)
    expect(row?.apiRequestCount).toBeGreaterThanOrEqual(6)
    console.info('assistant live usage', row)
  }, 120_000)
})
