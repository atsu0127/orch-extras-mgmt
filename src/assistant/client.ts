export type AssistantTextBlock = {
  type: 'text'
  text: string
}

export type AssistantToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export type AssistantToolResultBlock = {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

export type AssistantInputBlock =
  | AssistantTextBlock
  | AssistantToolUseBlock
  | AssistantToolResultBlock

export type AssistantOutputBlock = AssistantTextBlock | AssistantToolUseBlock

export type AssistantMessage = {
  role: 'user' | 'assistant'
  content: string | Array<AssistantInputBlock>
}

export type AssistantTurnRequest = {
  system: string
  messages: Array<AssistantMessage>
  tools: 'search' | 'none'
  maxTokens: number
}

export type AssistantTurnResponse = {
  content: Array<AssistantOutputBlock>
  usage: {
    inputTokens: number
    outputTokens: number
  }
  stopReason: string | null
}

export type AssistantClient = {
  complete: (request: AssistantTurnRequest) => Promise<AssistantTurnResponse>
}

export class AssistantClientError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'unavailable' | 'failed',
  ) {
    super(message)
    this.name = 'AssistantClientError'
  }
}
