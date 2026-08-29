import { describe, expect, it } from 'vitest'
import {
  aiGatewayAuthHeaders,
  aiGatewayMetadataHeaders,
  anthropicGatewayBaseUrl,
} from './gateway'

const config = {
  accountId: 'acct_test',
  gatewayId: 'orch-extras',
  token: 'gateway-token',
}

describe('AI Gateway の宛先とメタデータ', () => {
  it('Anthropic 用の baseURL を組み立てる', () => {
    expect(anthropicGatewayBaseUrl(config)).toBe(
      'https://gateway.ai.cloudflare.com/v1/acct_test/orch-extras/anthropic',
    )
  })

  it('認証ヘッダは cf-aig-authorization にする', () => {
    expect(aiGatewayAuthHeaders(config.token)).toEqual({
      'cf-aig-authorization': 'Bearer gateway-token',
    })
  })

  it('メタデータは questionId / turn / role の3キーだけにする', () => {
    const headers = aiGatewayMetadataHeaders({
      questionId: '11111111-1111-4111-8111-111111111111',
      turn: 1,
      role: 'extra',
    })
    const parsed: unknown = JSON.parse(headers['cf-aig-metadata'])
    expect(parsed).toEqual({
      questionId: '11111111-1111-4111-8111-111111111111',
      turn: 1,
      role: 'extra',
    })
    expect(Object.keys(parsed as object).sort()).toEqual([
      'questionId',
      'role',
      'turn',
    ])
    expect(JSON.stringify(parsed)).not.toContain('203.0.113')
  })
})
