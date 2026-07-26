import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { logout } from '../../auth/functions'
import {
  forgetCurrentSession,
  loadCurrentSession,
} from '../../auth/session-cache'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await loadCurrentSession()
    if (!session) throw redirect({ to: '/login' })

    return { session }
  },
  component: AuthedLayout,
})

const ROLE_LABELS = {
  admin: '管理者',
  extra: 'エキストラ',
} as const

function AuthedLayout() {
  const { session } = Route.useRouteContext()

  return (
    <>
      <header className="app-header">
        <span>{ROLE_LABELS[session.role]}としてログイン中</span>
        <LogoutButton />
      </header>
      <Outlet />
    </>
  )
}

function LogoutButton() {
  const submitLogout = useServerFn(logout)
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  async function handleClick() {
    setSubmitting(true)
    try {
      await submitLogout()
      forgetCurrentSession()
      await router.navigate({ to: '/login' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      className="link-button"
      onClick={handleClick}
      disabled={submitting}
    >
      ログアウト
    </button>
  )
}
