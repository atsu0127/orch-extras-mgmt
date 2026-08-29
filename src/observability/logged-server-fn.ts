import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { emitAppLog } from '../lib/app-log'
import {
  buildServerFnLog,
  classifyThrownError,
  outcomeFromResult,
  roleFromContextAndResult,
} from '../lib/server-fn-log'

type ServerFnMethod = 'GET' | 'POST'

/**
 * `requireAuth` の外側に置く。ログのためだけにセッションを D1 へ再照会しない
 * （docs/observability/design.md 4.1）。CSRF 拒否は request middleware で
 * 終わるため、この関数 middleware には届かない。
 */
export function logServerFn(fn: string) {
  return createMiddleware({ type: 'function' }).server(
    async ({ next, context }) => {
      const started = Date.now()
      try {
        const result = await next()
        const payload = 'result' in result ? result.result : undefined
        const mergedContext =
          'context' in result && result.context !== undefined
            ? result.context
            : context
        const outcome = outcomeFromResult(payload)
        emitAppLog(
          buildServerFnLog({
            fn,
            ok: outcome.ok,
            durationMs: elapsedMs(started),
            role: roleFromContextAndResult(mergedContext, payload),
            ...(outcome.ok ? {} : { error: outcome.error }),
          }),
        )
        return result
      } catch (error) {
        emitAppLog(
          buildServerFnLog({
            fn,
            ok: false,
            durationMs: elapsedMs(started),
            role: roleFromContextAndResult(context, undefined),
            error: classifyThrownError(error),
          }),
        )
        throw error
      }
    },
  )
}

/** `getCurrentSession` 以外のサーバ関数はこれを通す */
export function loggedServerFn(
  fn: string,
  options: { method: ServerFnMethod },
) {
  return createServerFn({ method: options.method }).middleware([
    logServerFn(fn),
  ])
}

function elapsedMs(started: number): number {
  return Math.max(0, Date.now() - started)
}
