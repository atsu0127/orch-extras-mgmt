import { requireAuth } from '../auth/middleware'
import {
  type AskAssistantResult,
  askAssistantInputSchema,
} from '../lib/assistant'
import { loggedServerFn } from '../observability/logged-server-fn'
import { runAskAssistant } from './ask'

export const askAssistant = loggedServerFn('askAssistant', { method: 'POST' })
  .middleware([requireAuth])
  .validator(askAssistantInputSchema)
  .handler(
    async ({ data, context }): Promise<AskAssistantResult> =>
      runAskAssistant(data, context.session.role),
  )
