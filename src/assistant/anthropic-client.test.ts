import { afterEach, describe, expect, it, vi } from 'vitest'

const { FakeAnthropic, createMessage, constructed } = vi.hoisted(() => {
  const createMessage = vi.fn()
  const constructed: Array<unknown> = []
  class FakeAnthropic {
    messages = { create: createMessage }
    constructor(options: unknown) {
      constructed.push(options)
    }
  }
  return { FakeAnthropic, createMessage, constructed }
})

vi.mock('@anthropic-ai/sdk', () => {
  class APIConnectionTimeoutError extends Error {
    constructor() {
      super('timeout')
      this.name = 'APIConnectionTimeoutError'
    }
  }
  class AuthenticationError extends Error {
    constructor() {
      super('auth')
      this.name = 'AuthenticationError'
    }
  }
  class PermissionDeniedError extends Error {
    constructor() {
      super('denied')
      this.name = 'PermissionDeniedError'
    }
  }
  return {
    default: FakeAnthropic,
    APIConnectionTimeoutError,
    AuthenticationError,
    PermissionDeniedError,
  }
})

import { createAnthropicClient } from './anthropic-client'

const emptyMessage = {
  content: [{ type: 'text', text: '{}' }],
  usage: { input_tokens: 1, output_tokens: 1 },
  stop_reason: 'end_turn',
}

afterEach(() => {
  createMessage.mockReset()
  constructed.length = 0
})

describe('createAnthropicClient', () => {
  it('Gateway 設定時は baseURL・認証ヘッダ・turn ごとの3キーを付ける', async () => {
    createMessage.mockResolvedValue(emptyMessage)

    const client = createAnthropicClient('sk-test', {
      config: {
        accountId: 'acct_test',
        gatewayId: 'orch-extras',
        token: 'gateway-token',
      },
      questionId: '11111111-1111-4111-8111-111111111111',
      role: 'admin',
    })

    expect(constructed[0]).toEqual({
      apiKey: 'sk-test',
      maxRetries: 0,
      timeout: 20_000,
      baseURL:
        'https://gateway.ai.cloudflare.com/v1/acct_test/orch-extras/anthropic',
      defaultHeaders: {
        'cf-aig-authorization': 'Bearer gateway-token',
      },
    })

    await client.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'q' }],
      tools: 'search',
      maxTokens: 16,
    })
    await client.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'q' }],
      tools: 'none',
      maxTokens: 16,
    })

    const firstHeaders = createMessage.mock.calls[0]?.[1] as {
      headers: { 'cf-aig-metadata': string }
    }
    const secondHeaders = createMessage.mock.calls[1]?.[1] as {
      headers: { 'cf-aig-metadata': string }
    }
    const firstMeta = JSON.parse(
      firstHeaders.headers['cf-aig-metadata'],
    ) as Record<string, unknown>
    const secondMeta = JSON.parse(
      secondHeaders.headers['cf-aig-metadata'],
    ) as Record<string, unknown>
    expect(Object.keys(firstMeta).sort()).toEqual([
      'questionId',
      'role',
      'turn',
    ])
    expect(firstMeta).toEqual({
      questionId: '11111111-1111-4111-8111-111111111111',
      turn: 1,
      role: 'admin',
    })
    expect(secondMeta.turn).toBe(2)
  })

  it('未設定では baseURL を差し替えない', async () => {
    createMessage.mockResolvedValue(emptyMessage)

    const client = createAnthropicClient('sk-test')
    await client.complete({
      system: 'sys',
      messages: [{ role: 'user', content: 'q' }],
      tools: 'none',
      maxTokens: 16,
    })

    expect(constructed[0]).toEqual({
      apiKey: 'sk-test',
      maxRetries: 0,
      timeout: 20_000,
    })
    expect(createMessage.mock.calls[0]?.[1]).toEqual({})
  })
})
