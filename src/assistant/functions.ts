import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '../auth/middleware'
import {
  type AskAssistantResult,
  askAssistantInputSchema,
} from '../lib/assistant'
import { logServerFn } from '../observability/logged-server-fn'
import { runAskAssistant } from './ask'

export const askAssistant = createServerFn({ method: 'POST' })
  .middleware([logServerFn('askAssistant'), requireAuth])
  .validator(askAssistantInputSchema)
  .handler(
    async ({ data, context }): Promise<AskAssistantResult> =>
      runAskAssistant(data, context.session.role),
  )
