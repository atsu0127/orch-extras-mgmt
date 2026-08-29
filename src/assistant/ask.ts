import { getClientIp } from '../auth/client-ip'
import { getDb } from '../db/client'
import { emitAppLog } from '../lib/app-log'
import type { AskAssistantInput, AskAssistantResult } from '../lib/assistant'
import { buildAssistantAskLog } from '../lib/assistant-ask-log'
import type { Role } from '../lib/roles'
import {
  isAssistantStub,
  readAnthropicApiKey,
  shouldReserveAssistantQuota,
} from './config'
import { type AssistantLoopLog, answerQuestion } from './loop'
import { createStubClient } from './stub-client'

export async function runAskAssistant(
  input: AskAssistantInput,
  role: Role,
): Promise<AskAssistantResult> {
  const questionId = crypto.randomUUID()
  const stub = isAssistantStub()
  const gateway = false
  let loopLog: AssistantLoopLog = { apiRequestCount: 0 }

  const finish = (result: AskAssistantResult): AskAssistantResult => {
    emitAppLog(
      buildAssistantAskLog({
        questionId,
        ok: result.ok,
        role,
        stub,
        gateway,
        apiRequestCount: loopLog.apiRequestCount,
        selectedConcertId: input.selectedConcertId,
        ...(result.ok
          ? { droppedSourceKeys: loopLog.droppedSourceKeys ?? 0 }
          : { reason: result.reason }),
      }),
    )
    return result
  }

  if (!shouldReserveAssistantQuota()) {
    return finish({ ok: false, reason: 'unavailable' })
  }

  const onLog = (log: AssistantLoopLog) => {
    loopLog = log
  }

  if (stub) {
    return finish(
      await answerQuestion({
        db: getDb(),
        client: createStubClient(),
        input,
        ip: getClientIp(),
        onLog,
      }),
    )
  }

  const apiKey = readAnthropicApiKey()
  if (!apiKey) return finish({ ok: false, reason: 'unavailable' })

  const { createAnthropicClient } = await import('./anthropic-client')
  return finish(
    await answerQuestion({
      db: getDb(),
      client: createAnthropicClient(apiKey),
      input,
      ip: getClientIp(),
      onLog,
    }),
  )
}
