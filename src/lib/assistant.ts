import { z } from 'zod'
import { MESSAGES } from './validation'

/**
 * AI案内の画面とサーバが共有する定数・型・入力検証。
 * スキーマを読むと drizzle がクライアントへ載るため、ここへ置く。
 */

export const ASSISTANT_MODEL = 'claude-haiku-4-5-20251001'

export const ASSISTANT_LIMITS = {
  questionMax: 500,
  historyMessages: 6,
  historyMessageMax: 2000,
  concertQueryMax: 100,
  keywordsMax: 100,
  topicsMax: 3,
  searchItemsMax: 30,
  searchCharsMax: 20_000,
  firstResponseTokensMax: 1024,
  outputTokensMax: 400,
  apiTimeoutMs: 20_000,
  conversationsMax: 10,
  messagesPerConversationMax: 20,
  conversationTitleMax: 40,
  ipWindowMs: 10 * 60 * 1000,
  ipQuestionsMax: 15,
  dailyQuestionsMax: 80,
} as const

export const SEARCH_TOPICS = [
  'concert',
  'practices',
  'announcements',
  'resources',
  'pieces',
  'recordings',
] as const

export type SearchTopic = (typeof SEARCH_TOPICS)[number]

export const SEARCH_TOPIC_SET = new Set<string>(SEARCH_TOPICS)

export type SourceLink = {
  key: string
  label: string
  href: string
  external: boolean
}

export type AssistantChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AskAssistantSuccess = {
  ok: true
  answer: string
  concertName: string | null
  links: Array<SourceLink>
  answeredAt: string
}

export type AskAssistantFailureReason =
  | 'invalid_input'
  | 'unavailable'
  | 'timeout'
  | 'tool_limit'
  | 'failed'

export type AskAssistantFailure = {
  ok: false
  reason: AskAssistantFailureReason
}

export type AskAssistantResult = AskAssistantSuccess | AskAssistantFailure

const tooLong = (max: number) => `${max}文字以内で入力してください`

export const assistantHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .trim()
    .min(1, MESSAGES.required)
    .max(
      ASSISTANT_LIMITS.historyMessageMax,
      tooLong(ASSISTANT_LIMITS.historyMessageMax),
    ),
})

export const askAssistantInputSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, MESSAGES.required)
    .max(ASSISTANT_LIMITS.questionMax, tooLong(ASSISTANT_LIMITS.questionMax)),
  selectedConcertId: z.number().int().positive(),
  history: z
    .array(assistantHistoryMessageSchema)
    .max(ASSISTANT_LIMITS.historyMessages),
})

export type AskAssistantInput = z.infer<typeof askAssistantInputSchema>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const optionalDateString = z
  .string()
  .trim()
  .refine((value) => DATE_PATTERN.test(value), MESSAGES.date)
  .optional()

export const searchPortalInputSchema = z
  .object({
    concert: z
      .string()
      .trim()
      .max(
        ASSISTANT_LIMITS.concertQueryMax,
        tooLong(ASSISTANT_LIMITS.concertQueryMax),
      )
      .nullable(),
    topics: z
      .array(z.enum(SEARCH_TOPICS))
      .min(1)
      .max(ASSISTANT_LIMITS.topicsMax)
      .refine(
        (topics) => new Set(topics).size === topics.length,
        'トピックは重複できません',
      ),
    keywords: z
      .string()
      .trim()
      .max(ASSISTANT_LIMITS.keywordsMax, tooLong(ASSISTANT_LIMITS.keywordsMax))
      .optional(),
    dateFrom: optionalDateString,
    dateTo: optionalDateString,
  })
  .refine(
    (value) =>
      value.dateFrom === undefined ||
      value.dateTo === undefined ||
      value.dateFrom <= value.dateTo,
    '日付の範囲が逆です',
  )

export type SearchPortalInput = z.infer<typeof searchPortalInputSchema>

export const assistantAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(2000),
  concertName: z.string().trim().min(1).max(100).nullable(),
  sourceKeys: z.array(z.string().trim().min(1).max(80)).max(20),
})

export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>

export const ASK_ASSISTANT_ERROR_MESSAGES: Record<
  AskAssistantFailureReason,
  string
> = {
  invalid_input: '質問を入力し直してください。',
  unavailable: 'AI案内は一時的に利用できません。',
  timeout: '応答が時間内に返りませんでした。もう一度試してください。',
  tool_limit:
    '検索の上限を超えたため、回答を止めました。もう一度試してください。',
  failed: '回答を作成できませんでした。もう一度試してください。',
}

export const ASSISTANT_PRIVACY_NOTICE =
  '氏名や連絡先などの個人情報は質問へ入力しないでください。履歴はこの端末の同じロールで共有されます。'

export const SUGGESTED_QUESTIONS = [
  '次の練習はいつですか？',
  '出欠の回答先はどこですか？',
  'ボウイングの楽譜はどこにありますか？',
  '新しいお知らせはありますか？',
] as const
