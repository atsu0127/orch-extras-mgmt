import { describe, expect, it } from 'vitest'
import { buildAssistantAskLog } from './assistant-ask-log'

const QUESTION_ID = '11111111-1111-4111-8111-111111111111'

describe('buildAssistantAskLog', () => {
  it('失敗時は reason を出し、本文や IP のキーは載せない', () => {
    const entry = buildAssistantAskLog({
      questionId: QUESTION_ID,
      ok: false,
      role: 'extra',
      stub: true,
      gateway: false,
      apiRequestCount: 0,
      selectedConcertId: 3,
      reason: 'ip_limited',
    })
    expect(entry).toEqual({
      event: 'assistant_ask',
      questionId: QUESTION_ID,
      ok: false,
      role: 'extra',
      stub: true,
      gateway: false,
      apiRequestCount: 0,
      selectedConcertId: 3,
      reason: 'ip_limited',
    })
    expect('droppedSourceKeys' in entry).toBe(false)
    const json = JSON.stringify(entry)
    expect(json).not.toContain('203.0.113')
    expect(json).not.toContain('次の練習')
    expect(Object.keys(entry).sort()).toEqual([
      'apiRequestCount',
      'event',
      'gateway',
      'ok',
      'questionId',
      'reason',
      'role',
      'selectedConcertId',
      'stub',
    ])
  })

  it('成功時だけ discarded 件数を出し、キー文字列は出さない', () => {
    const entry = buildAssistantAskLog({
      questionId: QUESTION_ID,
      ok: true,
      role: 'admin',
      stub: false,
      gateway: true,
      apiRequestCount: 2,
      selectedConcertId: 1,
      droppedSourceKeys: 2,
    })
    expect(entry.droppedSourceKeys).toBe(2)
    expect('reason' in entry).toBe(false)
    expect(JSON.stringify(entry)).not.toContain('practice:')
  })
})
