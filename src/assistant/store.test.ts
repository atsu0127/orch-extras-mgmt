import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadAssistantHistory } from '../lib/assistant-history'
import {
  clearAssistantConversations,
  deleteAssistantConversation,
  hydrateAssistantStore,
  resetAssistantStore,
  sendAssistantQuestion,
  startAssistantConversation,
} from './store'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  resetAssistantStore()
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
    },
    removeItem: (key) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
    key: (index) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size
    },
  }
})

afterEach(() => {
  resetAssistantStore()
  memory.clear()
})

describe('assistant store', () => {
  it('質問を送り、履歴を localStorage に残す', async () => {
    hydrateAssistantStore('admin')
    await sendAssistantQuestion({
      question: '次の練習はいつですか？',
      selectedConcertId: 1,
      ask: async () => ({
        ok: true,
        answer: '8月10日です',
        concertName: '第10回定期演奏会',
        links: [
          {
            key: 'practice:1',
            label: '練習',
            href: '/practices?concert=1',
            external: false,
          },
        ],
        answeredAt: '2026-08-17T00:00:00.000Z',
      }),
    })

    const saved = loadAssistantHistory('admin')
    expect(saved.conversations[0]?.title).toBe('次の練習はいつですか？')
    expect(saved.conversations[0]?.concertName).toBe('第10回定期演奏会')
    expect(saved.conversations[0]?.messages.map((item) => item.role)).toEqual([
      'user',
      'assistant',
    ])
  })

  it('演奏会を切り替えても履歴を維持する', async () => {
    hydrateAssistantStore('extra')
    await sendAssistantQuestion({
      question: '出欠は？',
      selectedConcertId: 1,
      ask: async () => ({
        ok: true,
        answer: '登録されています',
        concertName: '第10回定期演奏会',
        links: [],
        answeredAt: '2026-08-17T00:00:00.000Z',
      }),
    })

    const afterSwitch = loadAssistantHistory('extra')
    await sendAssistantQuestion({
      question: '曲は？',
      selectedConcertId: 2,
      ask: async () => ({
        ok: true,
        answer: '交響曲です',
        concertName: '室内楽の夕べ',
        links: [],
        answeredAt: '2026-08-17T00:01:00.000Z',
      }),
    })

    expect(loadAssistantHistory('extra').conversations).toHaveLength(1)
    expect(
      loadAssistantHistory('extra').conversations[0]?.messages,
    ).toHaveLength(4)
    expect(afterSwitch.conversations[0]?.messages).toHaveLength(2)
  })

  it('失敗時は入力を残して再試行できる', async () => {
    hydrateAssistantStore('admin')
    let calls = 0
    const ask = async () => {
      calls += 1
      if (calls === 1) return { ok: false as const, reason: 'timeout' as const }
      return {
        ok: true as const,
        answer: '成功',
        concertName: null,
        links: [],
        answeredAt: '2026-08-17T00:00:00.000Z',
      }
    }

    await sendAssistantQuestion({
      question: '次の練習は？',
      selectedConcertId: 1,
      ask,
    })
    expect(
      loadAssistantHistory('admin').conversations[0]?.messages,
    ).toHaveLength(1)

    await sendAssistantQuestion({
      question: '次の練習は？',
      selectedConcertId: 1,
      ask,
      retry: true,
    })
    expect(
      loadAssistantHistory('admin').conversations[0]?.messages,
    ).toHaveLength(2)
    expect(calls).toBe(2)
  })

  it('会話の削除と全削除ができる', () => {
    hydrateAssistantStore('admin')
    const first = startAssistantConversation()
    startAssistantConversation()
    deleteAssistantConversation(first)
    expect(loadAssistantHistory('admin').conversations).toHaveLength(1)
    clearAssistantConversations()
    expect(loadAssistantHistory('admin').conversations).toEqual([])
  })
})
