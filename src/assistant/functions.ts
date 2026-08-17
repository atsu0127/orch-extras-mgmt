import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '../auth/middleware'
import { getDb } from '../db/client'
import {
  type AskAssistantResult,
  askAssistantInputSchema,
} from '../lib/assistant'
import { isAssistantStub, readAnthropicApiKey } from './config'
import { answerQuestion } from './loop'
import { createStubClient } from './stub-client'

export const askAssistant = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .validator(askAssistantInputSchema)
  .handler(async ({ data }): Promise<AskAssistantResult> => {
    if (isAssistantStub()) {
      return answerQuestion({
        db: getDb(),
        client: createStubClient(),
        input: data,
      })
    }

    const apiKey = readAnthropicApiKey()
    if (!apiKey) return { ok: false, reason: 'unavailable' }

    const { createAnthropicClient } = await import('./anthropic-client')
    return answerQuestion({
      db: getDb(),
      client: createAnthropicClient(apiKey),
      input: data,
    })
  })
