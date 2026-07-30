import {
  Alert,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { type FormEvent, useState } from 'react'
import { login } from '../auth/functions'
import { forgetCurrentSession, loadCurrentSession } from '../auth/session-cache'
import { forgetConcerts } from '../concerts/concert-cache'

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
      forgetConcerts()
      await router.navigate({ to: '/' })
    } catch {
      setError('通信に失敗しました。しばらくおいてから試してください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack mih="calc(100dvh - 2rem)" justify="center" align="center">
      <Paper
        component="form"
        onSubmit={handleSubmit}
        withBorder
        p="xl"
        radius="md"
        w="100%"
        maw="24rem"
        bg="var(--app-surface)"
        style={{ borderColor: 'var(--app-border)' }}
      >
        <Stack gap="md">
          <Title order={1}>エキストラ情報ポータル</Title>
          <Text c="dimmed">配布されたパスワードを入力してください。</Text>

          <PasswordInput
            id="password"
            name="password"
            label="パスワード"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          {error && (
            <Alert color="red" variant="light" role="alert">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            disabled={submitting || password === ''}
            fullWidth
          >
            {submitting ? 'ログイン中…' : 'ログイン'}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}
