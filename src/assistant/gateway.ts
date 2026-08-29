import type { Role } from '../lib/roles'

export type AiGatewayConfig = {
  accountId: string
  gatewayId: string
  token: string
}

export type AiGatewayTurnMeta = {
  questionId: string
  turn: 1 | 2
  role: Role
}

export function anthropicGatewayBaseUrl(config: AiGatewayConfig): string {
  return `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}/anthropic`
}

export function aiGatewayAuthHeaders(token: string): {
  'cf-aig-authorization': string
} {
  return { 'cf-aig-authorization': `Bearer ${token}` }
}

export function aiGatewayMetadataHeaders(meta: AiGatewayTurnMeta): {
  'cf-aig-metadata': string
} {
  const payload = {
    questionId: meta.questionId,
    turn: meta.turn,
    role: meta.role,
  }
  return { 'cf-aig-metadata': JSON.stringify(payload) }
}
