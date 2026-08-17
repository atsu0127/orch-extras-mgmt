import { env } from 'cloudflare:workers'

/** ローカルと CI で実 Claude API を呼ばない（docs/ai-assistant/design.md 11.2） */
export function isAssistantStub(): boolean {
  return env.ASSISTANT_STUB === '1'
}

export function readAnthropicApiKey(): string | null {
  const key = env.ANTHROPIC_API_KEY
  if (typeof key !== 'string') return null
  const trimmed = key.trim()
  return trimmed.length > 0 ? trimmed : null
}
