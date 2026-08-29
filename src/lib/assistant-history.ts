import { ASSISTANT_LIMITS, type SourceLink } from './assistant'
import type { Role } from './roles'

export const ASSISTANT_HISTORY_VERSION = 1

export type AssistantStoredUserMessage = {
  id: string
  role: 'user'
  content: string
  createdAt: string
}

export type AssistantStoredAssistantMessage = {
  id: string
  role: 'assistant'
  content: string
  createdAt: string
  concertName: string | null
  links: Array<SourceLink>
}

export type AssistantStoredMessage =
  | AssistantStoredUserMessage
  | AssistantStoredAssistantMessage

export type AssistantConversation = {
  id: string
  title: string
  concertName: string | null
  updatedAt: string
  messages: Array<AssistantStoredMessage>
}

export type AssistantHistory = {
  version: typeof ASSISTANT_HISTORY_VERSION
  conversations: Array<AssistantConversation>
  activeId: string | null
}

export function assistantStorageKey(role: Role): string {
  return `oem_assistant_v${ASSISTANT_HISTORY_VERSION}_${role}`
}

export function emptyAssistantHistory(): AssistantHistory {
  return {
    version: ASSISTANT_HISTORY_VERSION,
    conversations: [],
    activeId: null,
  }
}

export function conversationTitleFromQuestion(question: string): string {
  const compact = question.replace(/\s+/g, ' ').trim()
  if (compact.length <= ASSISTANT_LIMITS.conversationTitleMax) return compact
  return `${compact.slice(0, ASSISTANT_LIMITS.conversationTitleMax - 1)}…`
}

export function loadAssistantHistory(role: Role): AssistantHistory {
  const raw = readStorage(assistantStorageKey(role))
  if (raw === null) return emptyAssistantHistory()

  try {
    const parsed: unknown = JSON.parse(raw)
    const history = normalizeHistory(parsed)
    if (!history) {
      writeStorage(assistantStorageKey(role), emptyAssistantHistory())
      return emptyAssistantHistory()
    }
    return history
  } catch {
    writeStorage(assistantStorageKey(role), emptyAssistantHistory())
    return emptyAssistantHistory()
  }
}

export function saveAssistantHistory(
  role: Role,
  history: AssistantHistory,
): void {
  writeStorage(assistantStorageKey(role), pruneHistory(history))
}

export function pruneHistory(history: AssistantHistory): AssistantHistory {
  const conversations = [...history.conversations]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, ASSISTANT_LIMITS.conversationsMax)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(
        -ASSISTANT_LIMITS.messagesPerConversationMax,
      ),
    }))

  const ids = new Set(conversations.map((item) => item.id))
  const activeId =
    history.activeId && ids.has(history.activeId)
      ? history.activeId
      : (conversations[0]?.id ?? null)

  return {
    version: ASSISTANT_HISTORY_VERSION,
    conversations,
    activeId,
  }
}

function normalizeHistory(value: unknown): AssistantHistory | null {
  if (!isRecord(value) || value.version !== ASSISTANT_HISTORY_VERSION)
    return null
  if (!Array.isArray(value.conversations)) return null

  const conversations: Array<AssistantConversation> = []
  for (const item of value.conversations) {
    const conversation = normalizeConversation(item)
    if (!conversation) return null
    conversations.push(conversation)
  }

  const activeId =
    typeof value.activeId === 'string' || value.activeId === null
      ? value.activeId
      : null

  return pruneHistory({
    version: ASSISTANT_HISTORY_VERSION,
    conversations,
    activeId,
  })
}

function normalizeConversation(value: unknown): AssistantConversation | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.title !== 'string')
    return null
  if (typeof value.updatedAt !== 'string') return null
  if (value.concertName !== null && typeof value.concertName !== 'string') {
    return null
  }
  if (!Array.isArray(value.messages)) return null

  const messages: Array<AssistantStoredMessage> = []
  for (const item of value.messages) {
    const message = normalizeMessage(item)
    if (!message) return null
    messages.push(message)
  }

  return {
    id: value.id,
    title: value.title,
    concertName: value.concertName,
    updatedAt: value.updatedAt,
    messages,
  }
}

function normalizeMessage(value: unknown): AssistantStoredMessage | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.createdAt !== 'string') {
    return null
  }
  if (typeof value.content !== 'string') return null
  if (value.role === 'user') {
    return {
      id: value.id,
      role: 'user',
      content: value.content,
      createdAt: value.createdAt,
    }
  }
  if (value.role !== 'assistant') return null
  if (value.concertName !== null && typeof value.concertName !== 'string') {
    return null
  }
  if (!Array.isArray(value.links)) return null

  const links: Array<SourceLink> = []
  for (const item of value.links) {
    const link = normalizeLink(item)
    if (!link) return null
    links.push(link)
  }

  return {
    id: value.id,
    role: 'assistant',
    content: value.content,
    createdAt: value.createdAt,
    concertName: value.concertName,
    links,
  }
}

function normalizeLink(value: unknown): SourceLink | null {
  if (!isRecord(value)) return null
  if (typeof value.key !== 'string' || typeof value.label !== 'string') {
    return null
  }
  if (typeof value.href !== 'string' || typeof value.external !== 'boolean') {
    return null
  }
  if (value.external) {
    try {
      const { protocol } = new URL(value.href)
      if (protocol !== 'http:' && protocol !== 'https:') return null
    } catch {
      return null
    }
  } else if (!value.href.startsWith('/')) {
    return null
  }
  return {
    key: value.key,
    label: value.label,
    href: value.href,
    external: value.external,
  }
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, history: AssistantHistory): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(history))
  } catch {
    // 容量超過などでもアプリ全体は落とさない
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
