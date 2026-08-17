import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import { isAssistantStub, readAnthropicApiKey } from './config'

afterEach(() => {
  env.ASSISTANT_STUB = ''
  env.ANTHROPIC_API_KEY = ''
})

describe('isAssistantStub', () => {
  it('1 のときだけスタブにする', () => {
    env.ASSISTANT_STUB = '1'
    expect(isAssistantStub()).toBe(true)

    env.ASSISTANT_STUB = '0'
    expect(isAssistantStub()).toBe(false)
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
