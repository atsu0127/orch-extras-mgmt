import type { SearchPortalInput, SearchTopic } from '../lib/assistant'
import type {
  AssistantClient,
  AssistantMessage,
  AssistantTurnRequest,
  AssistantTurnResponse,
} from './client'
import { AssistantClientError } from './client'
import type { SearchPortalModelResult } from './search'

const SEARCH_HINTS: Array<{ pattern: RegExp; topic: SearchTopic }> = [
  { pattern: /お知らせ/, topic: 'announcements' },
  { pattern: /楽譜|ボウイング|曲/, topic: 'pieces' },
  { pattern: /録音|録画/, topic: 'recordings' },
  { pattern: /資料|しおり/, topic: 'resources' },
  { pattern: /練習|日程/, topic: 'practices' },
  { pattern: /出欠|本番|概要/, topic: 'concert' },
]

/** CI とローカル確認用。Claude API は呼ばず、search_portal を1回要求してから JSON で返す */
export function createStubClient(): AssistantClient {
  return {
    async complete(request) {
      if (request.tools === 'search') {
        return stubToolUse(request)
      }
      return stubFinalAnswer(request)
    },
  }
}

function stubToolUse(request: AssistantTurnRequest): AssistantTurnResponse {
  const question = lastUserText(request.messages)
  if (question.includes('失敗テスト')) {
    throw new AssistantClientError('failed', 'failed')
  }
  return {
    content: [
      {
        type: 'tool_use',
        id: 'tool_stub_1',
        name: 'search_portal',
        input: inferSearchInput(question),
      },
    ],
    usage: { inputTokens: 12, outputTokens: 8 },
    stopReason: 'tool_use',
  }
}

function stubFinalAnswer(request: AssistantTurnRequest): AssistantTurnResponse {
  const data = readToolResult(request.messages)
  return {
    content: [{ type: 'text', text: JSON.stringify(stubAnswer(data)) }],
    usage: { inputTokens: 24, outputTokens: 16 },
    stopReason: 'end_turn',
  }
}

export function inferSearchInput(question: string): SearchPortalInput {
  const quoted = /演奏会「([^」]+)」/.exec(question)
  const topics: Array<SearchTopic> = []
  for (const hint of SEARCH_HINTS) {
    if (hint.pattern.test(question) && !topics.includes(hint.topic)) {
      topics.push(hint.topic)
    }
    if (topics.length === 3) break
  }

  return {
    concert: quoted?.[1] ?? null,
    topics: topics.length > 0 ? topics : ['concert', 'practices'],
  }
}

function stubAnswer(data: SearchPortalModelResult) {
  if (data.status === 'ambiguous') {
    const names = data.candidates.map((item) => item.name).join('、')
    return {
      answer: `演奏会が特定できません。候補: ${names}。どれですか？`,
      concertName: null,
      sourceKeys: [],
    }
  }
  if (data.status === 'not_found' || data.items.length === 0) {
    return {
      answer: '登録情報にありません',
      concertName: data.concertName,
      sourceKeys: [],
    }
  }
  const titles = data.items.map((item) => item.title).join('、')
  return {
    answer: `${data.concertName ?? '選択中の演奏会'}の登録情報です。${titles}`,
    concertName: data.concertName,
    sourceKeys: data.items.slice(0, 5).map((item) => item.key),
  }
}

function lastUserText(messages: ReadonlyArray<AssistantMessage>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'user' || typeof message.content !== 'string')
      continue
    return message.content
  }
  return ''
}

function readToolResult(
  messages: ReadonlyArray<AssistantMessage>,
): SearchPortalModelResult {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'user' || !Array.isArray(message.content)) continue
    for (const block of message.content) {
      if (block.type !== 'tool_result') continue
      const parsed = JSON.parse(block.content) as {
        data?: SearchPortalModelResult
      }
      if (parsed.data) return parsed.data
    }
  }
  return {
    status: 'not_found',
    concertName: null,
    candidates: [],
    items: [],
    truncated: false,
  }
}
