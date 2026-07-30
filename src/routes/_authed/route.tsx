import { Box, Button, NativeSelect, Stack, Text } from '@mantine/core'
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  retainSearchParams,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { z } from 'zod'
import { logout } from '../../auth/functions'
import {
  forgetCurrentSession,
  loadCurrentSession,
} from '../../auth/session-cache'
import { forgetConcerts, loadConcerts } from '../../concerts/concert-cache'
import { readRememberedConcert, rememberConcert } from '../../concerts/cookie'
import type { ConcertOption } from '../../concerts/queries'
import { resolveConcertId } from '../../concerts/selection'
import { formatFullDate, todayInJst } from '../../lib/date'
import { ROLE_LABELS } from '../../lib/roles'

export const Route = createFileRoute('/_authed')({
  validateSearch: z.object({
    concert: z.coerce.number().int().positive().optional(),
  }),
  // 画面を移っても選択中の演奏会が外れないようにする
  search: { middlewares: [retainSearchParams(['concert'])] },
  beforeLoad: async ({ search }) => {
    const session = await loadCurrentSession()
    if (!session) throw redirect({ to: '/login' })

    const concerts = await loadConcerts()
    const selectedId = resolveConcertId({
      concerts,
      requested: search.concert,
      remembered: readRememberedConcert(),
      today: todayInJst(),
    })
    const concert = concerts.find(({ id }) => id === selectedId) ?? null
    if (!concert) return { session, concerts, concert }

    rememberConcert(concert.id)
    // 選択の正は URL のクエリ（ADR-0009）。解決した結果と食い違うなら書き戻す。
    // 子ルートが持つクエリ（練習一覧のタブなど）を落とさないよう、既存の値に足す形にする
    if (search.concert !== concert.id) {
      throw redirect({
        search: (prev) => ({ ...prev, concert: concert.id }),
        replace: true,
      })
    }

    return { session, concerts, concert }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { session, concerts, concert } = Route.useRouteContext()

  return (
    <div className="app-frame">
      <header className="app-header">
        <Stack gap="sm">
          <Box
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.75rem',
            }}
          >
            <span className="app-brand">エキストラ情報ポータル</span>
            <LogoutButton />
          </Box>

          <Text size="xs" c="dimmed">
            {ROLE_LABELS[session.role]}としてログイン中
          </Text>

          {concert && (
            <ConcertSelector concerts={concerts} selectedId={concert.id} />
          )}
        </Stack>
      </header>

      {/*
        演奏会が無いときの表示は各画面に任せる。ここで差し替えると、
        演奏会を作る画面にも入れなくなる
      */}
      <Box component="main" className="app-main">
        <Outlet />
      </Box>

      <nav className="app-bottom-nav" aria-label="メイン">
        <BottomLink to="/" exact label="ホーム">
          <HomeIcon />
        </BottomLink>
        <BottomLink to="/practices" label="練習日程">
          <CalendarIcon />
        </BottomLink>
        <BottomLink to="/pieces" label="曲・ボウイング">
          <MusicIcon />
        </BottomLink>
        {session.role === 'admin' && (
          <BottomLink to="/admin" label="管理">
            <AdminIcon />
          </BottomLink>
        )}
      </nav>
    </div>
  )
}

type ConcertSelectorProps = {
  concerts: ReadonlyArray<ConcertOption>
  selectedId: number
}

function ConcertSelector({ concerts, selectedId }: ConcertSelectorProps) {
  const navigate = useNavigate()

  const groups = [
    { label: '進行中', items: concerts.filter((c) => c.status === 'active') },
    {
      label: 'アーカイブ済み',
      items: concerts.filter((c) => c.status === 'archived'),
    },
  ].filter((group) => group.items.length > 0)

  return (
    <NativeSelect
      id="concert-selector"
      label="演奏会"
      value={String(selectedId)}
      onChange={(event) => {
        const concert = Number(event.currentTarget.value)
        void navigate({ to: '.', search: (prev) => ({ ...prev, concert }) })
      }}
    >
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.items.map((concert) => (
            <option key={concert.id} value={concert.id}>
              {concertLabel(concert)}
            </option>
          ))}
        </optgroup>
      ))}
    </NativeSelect>
  )
}

function concertLabel(concert: ConcertOption): string {
  if (!concert.performanceDate) return concert.name
  return `${concert.name}（${formatFullDate(concert.performanceDate)}）`
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
      forgetConcerts()
      await router.navigate({ to: '/login' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="subtle"
      size="compact-sm"
      onClick={handleClick}
      disabled={submitting}
    >
      ログアウト
    </Button>
  )
}

type BottomLinkProps = {
  to: '/' | '/practices' | '/pieces' | '/admin'
  exact?: boolean
  label: string
  children: ReactNode
}

function BottomLink({ to, exact = false, label, children }: BottomLinkProps) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      aria-label={label}
      // data-active で見た目を切り替える。activeProps の型が Mantine 非依存の Link 向き
      activeProps={{ 'data-active': 'true' }}
      inactiveProps={{ 'data-active': 'false' }}
    >
      {children}
      <span>{label}</span>
    </Link>
  )
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <title>ホーム</title>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <title>練習日程</title>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <title>曲・ボウイング</title>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <title>管理</title>
      <path d="M4 20h16" />
      <path d="M7 20V10l5-6 5 6v10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}
