import { describe, expect, it } from 'vitest'
import {
  askAssistantInputSchema,
  assistantAnswerSchema,
  searchPortalInputSchema,
} from './assistant'

describe('askAssistantInputSchema', () => {
  it('500文字を超える質問を拒否する', () => {
    const result = askAssistantInputSchema.safeParse({
      question: 'あ'.repeat(501),
      selectedConcertId: 1,
      history: [],
    })
    expect(result.success).toBe(false)
  })

  it('履歴は6件まで', () => {
    const history = Array.from({ length: 7 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `m${index}`,
    }))
    const result = askAssistantInputSchema.safeParse({
      question: '次の練習は？',
      selectedConcertId: 1,
      history,
    })
    expect(result.success).toBe(false)
  })
})

describe('searchPortalInputSchema', () => {
  it('トピックの重複と4件以上を拒否する', () => {
    expect(
      searchPortalInputSchema.safeParse({
        concert: null,
        topics: ['concert', 'concert'],
      }).success,
    ).toBe(false)
    expect(
      searchPortalInputSchema.safeParse({
        concert: null,
        topics: ['concert', 'practices', 'announcements', 'pieces'],
      }).success,
    ).toBe(false)
  })

  it('日付が YYYY-MM-DD 以外なら拒否する', () => {
    expect(
      searchPortalInputSchema.safeParse({
        concert: null,
        topics: ['practices'],
        dateFrom: '2026/08/01',
      }).success,
    ).toBe(false)
  })
})

describe('assistantAnswerSchema', () => {
  it('空の回答は採用しない', () => {
    expect(
      assistantAnswerSchema.safeParse({
        answer: '   ',
        concertName: null,
        sourceKeys: [],
      }).success,
    ).toBe(false)
  })
})
