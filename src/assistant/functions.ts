import { getClientIp } from '../auth/client-ip'
import { requireAuth } from '../auth/middleware'
import { getDb } from '../db/client'
import {
  type AskAssistantResult,
  askAssistantInputSchema,
} from '../lib/assistant'
import { loggedServerFn } from '../observability/logged-server-fn'
import {
  isAssistantStub,
  readAnthropicApiKey,
  shouldReserveAssistantQuota,
} from './config'
import { answerQuestion } from './loop'
import { createStubClient } from './stub-client'

export const askAssistant = loggedServerFn('askAssistant', { method: 'POST' })
  .middleware([requireAuth])
  .validator(askAssistantInputSchema)
  .handler(async ({ data }): Promise<AskAssistantResult> => {
    if (!shouldReserveAssistantQuota()) {
      return { ok: false, reason: 'unavailable' }
    }

    const ip = getClientIp()
    if (isAssistantStub()) {
      return answerQuestion({
        db: getDb(),
        client: createStubClient(),
        input: data,
        ip,
      })
    }

    const apiKey = readAnthropicApiKey()
    if (!apiKey) return { ok: false, reason: 'unavailable' }

    const { createAnthropicClient } = await import('./anthropic-client')
    return answerQuestion({
      db: getDb(),
      client: createAnthropicClient(apiKey),
      input: data,
      ip,
    })
  })
