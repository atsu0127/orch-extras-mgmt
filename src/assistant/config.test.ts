import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import {
  isAssistantStub,
  readAiGatewayConfig,
  readAnthropicApiKey,
  shouldReserveAssistantQuota,
} from './config'

afterEach(() => {
  env.ASSISTANT_STUB = ''
  env.ANTHROPIC_API_KEY = ''
  env.AI_GATEWAY_ACCOUNT_ID = ''
  env.AI_GATEWAY_ID = ''
  env.AI_GATEWAY_TOKEN = ''
})

describe('isAssistantStub', () => {
  it('1 のときだけスタブにする', () => {
    env.ASSISTANT_STUB = '1'
    expect(isAssistantStub()).toBe(true)

    env.ASSISTANT_STUB = '0'
    expect(isAssistantStub()).toBe(false)
  })
})

describe('shouldReserveAssistantQuota', () => {
  it('スタブかキーがあるときだけ確保する', () => {
    env.ASSISTANT_STUB = ''
    env.ANTHROPIC_API_KEY = ''
    expect(shouldReserveAssistantQuota()).toBe(false)

    env.ASSISTANT_STUB = '1'
    expect(shouldReserveAssistantQuota()).toBe(true)

    env.ASSISTANT_STUB = ''
    env.ANTHROPIC_API_KEY = 'sk-test'
    expect(shouldReserveAssistantQuota()).toBe(true)
  })
})

describe('readAnthropicApiKey', () => {
  it('空や空白だけの値は未設定として扱う', () => {
    env.ANTHROPIC_API_KEY = ''
    expect(readAnthropicApiKey()).toBeNull()

    env.ANTHROPIC_API_KEY = '   '
    expect(readAnthropicApiKey()).toBeNull()
  })

  it('前後の空白を除いて返す', () => {
    env.ANTHROPIC_API_KEY = ' sk-test '
    expect(readAnthropicApiKey()).toBe('sk-test')
  })
})

describe('readAiGatewayConfig', () => {
  it('3つ揃ったときだけ返す', () => {
    env.AI_GATEWAY_ACCOUNT_ID = 'acct'
    env.AI_GATEWAY_ID = 'gw'
    env.AI_GATEWAY_TOKEN = 'tok'
    expect(readAiGatewayConfig()).toEqual({
      accountId: 'acct',
      gatewayId: 'gw',
      token: 'tok',
    })
  })

  it('欠けや空白だけなら未設定として扱う', () => {
    env.AI_GATEWAY_ACCOUNT_ID = 'acct'
    env.AI_GATEWAY_ID = 'gw'
    env.AI_GATEWAY_TOKEN = ''
    expect(readAiGatewayConfig()).toBeNull()

    env.AI_GATEWAY_TOKEN = '   '
    expect(readAiGatewayConfig()).toBeNull()
  })
})
