import Anthropic, {
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
} from '@anthropic-ai/sdk'
import { ASSISTANT_LIMITS, ASSISTANT_MODEL } from '../lib/assistant'
import {
  type AssistantClient,
  AssistantClientError,
  type AssistantInputBlock,
  type AssistantOutputBlock,
} from './client'
import { SEARCH_PORTAL_TOOL } from './prompt'

export function createAnthropicClient(apiKey: string): AssistantClient {
  const anthropic = new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: ASSISTANT_LIMITS.apiTimeoutMs,
  })

  return {
    async complete(request) {
      try {
        const message = await anthropic.messages.create({
          model: ASSISTANT_MODEL,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: request.messages.map((item) => ({
            role: item.role,
            content:
              typeof item.content === 'string'
                ? item.content
                : item.content.map(toAnthropicInputBlock),
          })),
          tools: [SEARCH_PORTAL_TOOL],
          tool_choice:
            request.tools === 'search'
              ? {
                  type: 'tool',
                  name: 'search_portal',
                  disable_parallel_tool_use: true,
                }
              : { type: 'none' },
        })

        return {
          content: message.content.flatMap(fromAnthropicBlock),
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
          },
          stopReason: message.stop_reason,
        }
      } catch (error) {
        throw mapAnthropicError(error)
      }
    },
  }
}

function toAnthropicInputBlock(block: AssistantInputBlock) {
  if (block.type === 'text') return { type: 'text' as const, text: block.text }
  if (block.type === 'tool_use') {
    return {
      type: 'tool_use' as const,
      id: block.id,
      name: block.name,
      input: block.input,
    }
  }
  return {
    type: 'tool_result' as const,
    tool_use_id: block.tool_use_id,
    content: block.content,
  }
}

function fromAnthropicBlock(block: {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
}): Array<AssistantOutputBlock> {
  if (block.type === 'text' && typeof block.text === 'string') {
    return [{ type: 'text', text: block.text }]
  }
  if (
    block.type === 'tool_use' &&
    typeof block.id === 'string' &&
    typeof block.name === 'string'
  ) {
    return [
      {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      },
    ]
  }
  return []
}

function mapAnthropicError(error: unknown): AssistantClientError {
  if (error instanceof AssistantClientError) return error
  if (error instanceof APIConnectionTimeoutError) {
    return new AssistantClientError('timeout', 'timeout')
  }
  if (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError
  ) {
    return new AssistantClientError('unavailable', 'unavailable')
  }
  return new AssistantClientError('failed', 'failed')
}
