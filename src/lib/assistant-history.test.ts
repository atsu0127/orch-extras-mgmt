import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  assistantStorageKey,
  conversationTitleFromQuestion,
  emptyAssistantHistory,
  loadAssistantHistory,
  pruneHistory,
  saveAssistantHistory,
} from './assistant-history'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
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
  memory.clear()
})

describe('assistant history', () => {
  it('admin と extra で保存キーを分ける', () => {
    saveAssistantHistory('admin', {
      version: 1,
      conversations: [
        {
          id: 'a',
          title: '管理者の質問',
          concertName: '第10回',
          updatedAt: '2026-08-17T00:00:00.000Z',
          messages: [],
        },
      ],
      activeId: 'a',
    })

    expect(loadAssistantHistory('extra')).toEqual(emptyAssistantHistory())
    expect(loadAssistantHistory('admin').conversations[0]?.title).toBe(
      '管理者の質問',
    )
    expect(assistantStorageKey('admin')).not.toBe(assistantStorageKey('extra'))
  })

  it('10会話・20メッセージを超えたら古いものから落とす', () => {
    const conversations = Array.from({ length: 12 }, (_, index) => ({
      id: `c${index}`,
      title: `会話${index}`,
      concertName: null,
      updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      messages: Array.from({ length: 22 }, (__, messageIndex) => ({
        id: `m${index}-${messageIndex}`,
        role: 'user' as const,
        content: `q${messageIndex}`,
        createdAt: `2026-08-17T00:00:${String(messageIndex).padStart(2, '0')}.000Z`,
      })),
    }))

    const pruned = pruneHistory({
      version: 1,
      conversations,
      activeId: 'c0',
    })

    expect(pruned.conversations).toHaveLength(10)
    expect(pruned.conversations.map((item) => item.id)).not.toContain('c0')
    expect(pruned.conversations[0]?.messages).toHaveLength(20)
    expect(pruned.activeId).toBe('c11')
  })

  it('壊れた履歴は初期化してアプリを落とさない', () => {
    memory.set(assistantStorageKey('admin'), '{not-json')
    expect(loadAssistantHistory('admin')).toEqual(emptyAssistantHistory())
    expect(memory.get(assistantStorageKey('admin'))).toBe(
      JSON.stringify(emptyAssistantHistory()),
    )
  })

  it('javascript リンクは読み取り時に破棄する', () => {
    memory.set(
      assistantStorageKey('extra'),
      JSON.stringify({
        version: 1,
        activeId: 'a',
        conversations: [
          {
            id: 'a',
            title: '質問',
            concertName: null,
            updatedAt: '2026-08-17T00:00:00.000Z',
            messages: [
              {
                id: 'm1',
                role: 'assistant',
                content: '回答',
                createdAt: '2026-08-17T00:00:00.000Z',
                concertName: null,
                links: [
                  {
                    key: 'x',
                    label: '危険',
                    href: 'javascript:alert(1)',
                    external: true,
                  },
                ],
              },
            ],
          },
        ],
      }),
    )

    expect(loadAssistantHistory('extra')).toEqual(emptyAssistantHistory())
  })

  it('演奏会IDでは名前空間を分けない', () => {
    saveAssistantHistory('admin', {
      version: 1,
      conversations: [
        {
          id: 'keep',
          title: '次の練習は？',
          concertName: '第10回定期演奏会',
          updatedAt: '2026-08-17T00:00:00.000Z',
          messages: [
            {
              id: 'm',
              role: 'user',
              content: '次の練習は？',
              createdAt: '2026-08-17T00:00:00.000Z',
            },
          ],
        },
      ],
      activeId: 'keep',
    })

    expect(loadAssistantHistory('admin').conversations[0]?.id).toBe('keep')
  })
})

describe('conversationTitleFromQuestion', () => {
  it('最初の質問を40文字で切る', () => {
    expect(conversationTitleFromQuestion('短い質問')).toBe('短い質問')
    expect(conversationTitleFromQuestion('あ'.repeat(41)).length).toBe(40)
  })
})
