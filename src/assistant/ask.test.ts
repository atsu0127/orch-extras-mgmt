import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  answerQuestion: vi.fn(),
  createAnthropicClient: vi.fn(),
  getClientIp: vi.fn(),
  getDb: vi.fn(),
}))

vi.mock('../db/client', () => ({ getDb: mocks.getDb }))
vi.mock('../auth/client-ip', () => ({ getClientIp: mocks.getClientIp }))
vi.mock('./loop', () => ({ answerQuestion: mocks.answerQuestion }))
vi.mock('./anthropic-client', () => ({
  createAnthropicClient: mocks.createAnthropicClient,
}))

import { runAskAssistant } from './ask'

const QUESTION_ID = '11111111-1111-4111-8111-111111111111'
const input = {
  question: '次の練習はいつですか？',
  selectedConcertId: 1,
  history: [],
}

afterEach(() => {
  vi.restoreAllMocks()
  mocks.answerQuestion.mockReset()
  env.ASSISTANT_STUB = ''
  env.ANTHROPIC_API_KEY = ''
  env.AI_GATEWAY_ACCOUNT_ID = ''
  env.AI_GATEWAY_ID = ''
  env.AI_GATEWAY_TOKEN = ''
})

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    QUESTION_ID as `${string}-${string}-${string}-${string}-${string}`,
  )
  mocks.getClientIp.mockReturnValue('203.0.113.10')
  mocks.getDb.mockReturnValue({})
  env.ASSISTANT_STUB = '1'
  env.ANTHROPIC_API_KEY = ''
})

function lastLog(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const entry = spy.mock.calls.at(-1)?.[0]
  if (!entry || typeof entry !== 'object') {
    throw new Error('expected a log object')
  }
  return entry as Record<string, unknown>
}

describe('runAskAssistant', () => {
  it('キー無しの unavailable でも questionId 付きの assistant_ask を出す', async () => {
    env.ASSISTANT_STUB = ''
    env.ANTHROPIC_API_KEY = ''
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const result = await runAskAssistant(input, 'extra')

    expect(result).toEqual({ ok: false, reason: 'unavailable' })
    expect(mocks.answerQuestion).not.toHaveBeenCalled()
    expect('apiRequestCount' in result).toBe(false)
    const entry = lastLog(spy)
    expect(entry).toMatchObject({
      event: 'assistant_ask',
      questionId: QUESTION_ID,
      ok: false,
      reason: 'unavailable',
      role: 'extra',
      stub: false,
      gateway: false,
      apiRequestCount: 0,
      selectedConcertId: 1,
    })
    const json = JSON.stringify(entry)
    expect(json).not.toContain('次の練習')
    expect(json).not.toContain('203.0.113')
  })

  it('上限超過は apiRequestCount 0 で出す', async () => {
    mocks.answerQuestion.mockImplementation(
      async ({ onLog }: { onLog?: (log: object) => void }) => {
        onLog?.({ apiRequestCount: 0 })
        return { ok: false, reason: 'daily_limited' }
      },
    )
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const result = await runAskAssistant(input, 'admin')

    expect(result).toEqual({ ok: false, reason: 'daily_limited' })
    expect(lastLog(spy)).toMatchObject({
      event: 'assistant_ask',
      questionId: QUESTION_ID,
      ok: false,
      reason: 'daily_limited',
      stub: true,
      gateway: false,
      apiRequestCount: 0,
    })
  })

  it('成功時の件数をログに出し、画面の戻り型には足さない', async () => {
    mocks.answerQuestion.mockImplementation(
      async ({ onLog }: { onLog?: (log: object) => void }) => {
        onLog?.({ apiRequestCount: 2, droppedSourceKeys: 2 })
        return {
          ok: true,
          answer: '8月10日に弦分奏があります',
          concertName: '第10回定期演奏会',
          links: [],
          answeredAt: '2026-08-29T00:00:00.000Z',
        }
      },
    )
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const result = await runAskAssistant(input, 'extra')

    expect(result.ok).toBe(true)
    expect(result).not.toHaveProperty('apiRequestCount')
    expect(result).not.toHaveProperty('droppedSourceKeys')
    expect(result).not.toHaveProperty('questionId')
    const entry = lastLog(spy)
    expect(entry).toMatchObject({
      event: 'assistant_ask',
      questionId: QUESTION_ID,
      ok: true,
      stub: true,
      gateway: false,
      apiRequestCount: 2,
      droppedSourceKeys: 2,
    })
    expect(JSON.stringify(entry)).not.toContain('弦分奏')
    expect(JSON.stringify(entry)).not.toContain('practice:')
  })

  it('Gateway 設定ありの実 API 経路は gateway: true にする', async () => {
    env.ASSISTANT_STUB = ''
    env.ANTHROPIC_API_KEY = 'sk-test'
    env.AI_GATEWAY_ACCOUNT_ID = 'acct'
    env.AI_GATEWAY_ID = 'gw'
    env.AI_GATEWAY_TOKEN = 'tok'
    const fakeClient = { complete: vi.fn() }
    mocks.createAnthropicClient.mockReturnValue(fakeClient)
    mocks.answerQuestion.mockImplementation(
      async ({ onLog }: { onLog?: (log: object) => void }) => {
        onLog?.({ apiRequestCount: 2, droppedSourceKeys: 0 })
        return {
          ok: true,
          answer: 'ok',
          concertName: null,
          links: [],
          answeredAt: '2026-08-29T00:00:00.000Z',
        }
      },
    )
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await runAskAssistant(input, 'extra')

    expect(mocks.createAnthropicClient).toHaveBeenCalledWith('sk-test', {
      config: { accountId: 'acct', gatewayId: 'gw', token: 'tok' },
      questionId: QUESTION_ID,
      role: 'extra',
    })
    expect(lastLog(spy)).toMatchObject({
      gateway: true,
      stub: false,
      apiRequestCount: 2,
    })
  })

  it('Gateway 未設定の実 API は直結し、スタブでは Claude を呼ばない', async () => {
    env.ASSISTANT_STUB = ''
    env.ANTHROPIC_API_KEY = 'sk-test'
    mocks.createAnthropicClient.mockReturnValue({ complete: vi.fn() })
    mocks.answerQuestion.mockImplementation(
      async ({ onLog }: { onLog?: (log: object) => void }) => {
        onLog?.({ apiRequestCount: 2 })
        return {
          ok: true,
          answer: 'ok',
          concertName: null,
          links: [],
          answeredAt: '2026-08-29T00:00:00.000Z',
        }
      },
    )
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await runAskAssistant(input, 'admin')

    expect(mocks.createAnthropicClient).toHaveBeenCalledWith('sk-test')
    expect(lastLog(spy)).toMatchObject({ gateway: false, stub: false })

    mocks.createAnthropicClient.mockClear()
    env.ASSISTANT_STUB = '1'
    env.AI_GATEWAY_ACCOUNT_ID = 'acct'
    env.AI_GATEWAY_ID = 'gw'
    env.AI_GATEWAY_TOKEN = 'tok'
    await runAskAssistant(input, 'admin')
    expect(mocks.createAnthropicClient).not.toHaveBeenCalled()
    expect(lastLog(spy)).toMatchObject({ gateway: false, stub: true })
  })
})
