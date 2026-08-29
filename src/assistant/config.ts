import { env } from 'cloudflare:workers'
import type { AiGatewayConfig } from './gateway'

export type { AiGatewayConfig }

/** ローカルと CI で実 Claude API を呼ばない（docs/ai-assistant/design.md 11.2） */
export function isAssistantStub(): boolean {
  return env.ASSISTANT_STUB === '1'
}

export function readAnthropicApiKey(): string | null {
  return readNonEmpty(env.ANTHROPIC_API_KEY)
}

/** 3つ揃ったときだけ Gateway 経由にする。未設定なら Anthropic 直結 */
export function readAiGatewayConfig(): AiGatewayConfig | null {
  const accountId = readNonEmpty(env.AI_GATEWAY_ACCOUNT_ID)
  const gatewayId = readNonEmpty(env.AI_GATEWAY_ID)
  const token = readNonEmpty(env.AI_GATEWAY_TOKEN)
  if (!accountId || !gatewayId || !token) return null
  return { accountId, gatewayId, token }
}

/** スタブまたは API キーがあるときだけ枠を確保する（キー無しでは Claude を呼ばない） */
export function shouldReserveAssistantQuota(): boolean {
  return isAssistantStub() || readAnthropicApiKey() !== null
}

function readNonEmpty(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
