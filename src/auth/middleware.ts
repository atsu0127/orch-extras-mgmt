import { redirect } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { getDb } from '../db/client'
import { readSessionCookie } from './cookie'
import { resolveSession } from './session'

/**
 * 認可の実体（設計書8.4）。SPA モードではルートの `beforeLoad` に強制力が無いので、
 * 読み取り系も含めたすべてのサーバ関数がこれか `requireAdmin` を通る。
 *
 * 例外は認証の入口そのものである `login` と `getCurrentSession` の2つだけ。
 */
export const requireAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const token = readSessionCookie()
    const session = token
      ? await resolveSession(getDb(), token, new Date())
      : null

    // 開いたままのタブでセッションが切れた場合にログイン画面へ戻せるよう、
    // エラーではなく redirect を投げる
    if (!session) throw redirect({ to: '/login' })

    return next({ context: { session } })
  },
)

export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([requireAuth])
  .server(async ({ next, context }) => {
    if (context.session.role !== 'admin') throw redirect({ to: '/' })

    return next()
  })
