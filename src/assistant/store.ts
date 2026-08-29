import { useCallback, useSyncExternalStore } from 'react'
import {
  ASSISTANT_LIMITS,
  type AskAssistantFailureReason,
  type AskAssistantInput,
  type AskAssistantResult,
} from '../lib/assistant'
import {
  type AssistantConversation,
  type AssistantHistory,
  conversationTitleFromQuestion,
  emptyAssistantHistory,
  loadAssistantHistory,
  saveAssistantHistory,
} from '../lib/assistant-history'
import type { Role } from '../lib/roles'

export type AskAssistantFn = (payload: {
  data: AskAssistantInput
}) => Promise<AskAssistantResult>

export type AssistantStoreState = AssistantHistory & {
  role: Role | null
  panelOpen: boolean
  sending: boolean
  errorReason: AskAssistantFailureReason | null
}

const listeners = new Set<() => void>()

let state: AssistantStoreState = emptyStore()

function emptyStore(): AssistantStoreState {
  return {
    ...emptyAssistantHistory(),
    role: null,
    panelOpen: false,
    sending: false,
    errorReason: null,
  }
}

export function getAssistantStore(): AssistantStoreState {
  return state
}

export function subscribeAssistantStore(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAssistantStore(): AssistantStoreState {
  return useSyncExternalStore(
    subscribeAssistantStore,
    getAssistantStore,
    getAssistantStore,
  )
}

export function hydrateAssistantStore(role: Role): void {
  if (state.role === role) return
  const history = loadAssistantHistory(role)
  state = {
    ...history,
    role,
    panelOpen: false,
    sending: false,
    errorReason: null,
  }
  emit()
}

export function resetAssistantStore(): void {
  state = emptyStore()
  emit()
}

export function openAssistantPanel(): void {
  state = { ...state, panelOpen: true }
  emit()
}

export function closeAssistantPanel(): void {
  state = { ...state, panelOpen: false }
  emit()
}

export function selectAssistantConversation(id: string): void {
  if (!state.conversations.some((item) => item.id === id)) return
  persist({ ...state, activeId: id, errorReason: null })
}

export function startAssistantConversation(): string {
  const id = createId()
  const now = new Date().toISOString()
  const conversation: AssistantConversation = {
    id,
    title: '新しい会話',
    concertName: null,
    updatedAt: now,
    messages: [],
  }
  persist({
    ...state,
    conversations: [conversation, ...state.conversations],
    activeId: id,
    errorReason: null,
  })
  return id
}

export function deleteAssistantConversation(id: string): void {
  const conversations = state.conversations.filter((item) => item.id !== id)
  persist({
    ...state,
    conversations,
    activeId:
      state.activeId === id ? (conversations[0]?.id ?? null) : state.activeId,
    errorReason: null,
  })
}

export function clearAssistantConversations(): void {
  persist({
    ...state,
    conversations: [],
    activeId: null,
    errorReason: null,
  })
}

export async function sendAssistantQuestion(options: {
  question: string
  selectedConcertId: number
  ask: AskAssistantFn
  retry?: boolean
}): Promise<void> {
  if (state.role === null || state.sending) return
  const role = state.role

  const question = options.question.trim()
  if (question.length === 0) return

  const now = new Date().toISOString()
  let history: AssistantHistory = {
    version: state.version,
    conversations: state.conversations,
    activeId: state.activeId,
  }

  if (!options.retry) {
    if (history.activeId === null) {
      const id = createId()
      history = {
        ...history,
        conversations: [
          {
            id,
            title: conversationTitleFromQuestion(question),
            concertName: null,
            updatedAt: now,
            messages: [],
          },
          ...history.conversations,
        ],
        activeId: id,
      }
    }
    history = appendMessage(history, {
      id: createId(),
      role: 'user',
      content: question,
      createdAt: now,
    })
  }

  const active = history.conversations.find(
    (item) => item.id === history.activeId,
  )
  if (!active) return

  const prior =
    active.messages.at(-1)?.role === 'user'
      ? active.messages.slice(0, -1)
      : active.messages
  const historyMessages = prior
    .slice(-ASSISTANT_LIMITS.historyMessages)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))

  state = {
    ...state,
    ...history,
    sending: true,
    errorReason: null,
  }
  saveAssistantHistory(role, history)
  emit()

  const result = await options.ask({
    data: {
      question,
      selectedConcertId: options.selectedConcertId,
      history: historyMessages,
    },
  })

  if (!result.ok) {
    state = {
      ...state,
      sending: false,
      errorReason: result.reason,
    }
    emit()
    return
  }

  history = appendMessage(
    {
      version: state.version,
      conversations: state.conversations,
      activeId: state.activeId,
    },
    {
      id: createId(),
      role: 'assistant',
      content: result.answer,
      createdAt: result.answeredAt,
      concertName: result.concertName,
      links: result.links,
    },
    result.concertName,
  )
  state = {
    ...state,
    ...history,
    sending: false,
    errorReason: null,
  }
  saveAssistantHistory(role, history)
  emit()
}

function appendMessage(
  history: AssistantHistory,
  message: AssistantConversation['messages'][number],
  concertName: string | null = null,
): AssistantHistory {
  return {
    ...history,
    conversations: history.conversations.map((conversation) => {
      if (conversation.id !== history.activeId) return conversation
      const title =
        conversation.messages.length === 0 && message.role === 'user'
          ? conversationTitleFromQuestion(message.content)
          : conversation.title
      return {
        ...conversation,
        title,
        concertName: concertName ?? conversation.concertName,
        updatedAt: message.createdAt,
        messages: [...conversation.messages, message],
      }
    }),
  }
}

function persist(next: AssistantStoreState | AssistantHistory): void {
  const history: AssistantHistory = {
    version: next.version,
    conversations: next.conversations,
    activeId: next.activeId,
  }
  state = {
    ...state,
    ...history,
  }
  if (state.role) saveAssistantHistory(state.role, history)
  emit()
}

function emit(): void {
  for (const listener of listeners) listener()
}

function createId(): string {
  return crypto.randomUUID()
}

export function useAssistantPanel() {
  const store = useAssistantStore()
  const open = useCallback(() => openAssistantPanel(), [])
  const close = useCallback(() => closeAssistantPanel(), [])
  return { open, close, panelOpen: store.panelOpen }
}
