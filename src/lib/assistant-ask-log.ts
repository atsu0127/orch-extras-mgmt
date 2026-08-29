import type { AskAssistantFailureReason } from './assistant'
import type { Role } from './roles'

export const ASSISTANT_ASK_EVENT = 'assistant_ask' as const

export type AssistantAskLog = {
  event: typeof ASSISTANT_ASK_EVENT
  questionId: string
  ok: boolean
  role: Role
  stub: boolean
  gateway: boolean
  apiRequestCount: number
  selectedConcertId: number
  reason?: AskAssistantFailureReason
  droppedSourceKeys?: number
}

export type AssistantAskLogInput = {
  questionId: string
  ok: boolean
  role: Role
  stub: boolean
  gateway: boolean
  apiRequestCount: number
  selectedConcertId: number
  reason?: AskAssistantFailureReason
  droppedSourceKeys?: number
}

export function buildAssistantAskLog(
  input: AssistantAskLogInput,
): AssistantAskLog {
  const entry: AssistantAskLog = {
    event: ASSISTANT_ASK_EVENT,
    questionId: input.questionId,
    ok: input.ok,
    role: input.role,
    stub: input.stub,
    gateway: input.gateway,
    apiRequestCount: input.apiRequestCount,
    selectedConcertId: input.selectedConcertId,
  }
  if (!input.ok && input.reason !== undefined) {
    entry.reason = input.reason
  }
  if (input.ok && input.droppedSourceKeys !== undefined) {
    entry.droppedSourceKeys = input.droppedSourceKeys
  }
  return entry
}
