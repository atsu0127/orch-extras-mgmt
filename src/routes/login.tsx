import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useState } from 'react'
import { login } from '../auth/functions'
import { forgetCurrentSession, loadCurrentSession } from '../auth/session-cache'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    // 期限切れで飛ばされてきた場合にキャッシュを信じるとログイン画面へ入れず
    // 往復し続けるため、ここだけは必ずサーバに確かめる
    forgetCurrentSession()
    if (await loadCurrentSession()) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

const FAILURE_MESSAGES = {
  invalid: 'パスワードが違います。',
  rate_limited:
    '試行が続いたため、しばらく受け付けません。5分ほどおいてからやり直してください。',
} as const

function LoginPage() {
  const submitLogin = useServerFn(login)
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const result = await submitLogin({ data: { password } })
      if (!result.ok) {
        setError(FAILURE_MESSAGES[result.reason])
        return
      }
      forgetCurrentSession()
      await router.navigate({ to: '/' })
    } catch {
      setError('通信に失敗しました。しばらくおいてから試してください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="centered">
      <form className="card" onSubmit={handleSubmit}>
        <h1>エキストラ情報ポータル</h1>
        <p>配布されたパスワードを入力してください。</p>

        <label className="field" htmlFor="password">
          パスワード
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting || password === ''}>
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
    </main>
  )
}
