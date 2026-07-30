import {
  Anchor,
  Box,
  Button,
  Group,
  NativeSelect,
  Stack,
  Text,
} from '@mantine/core'
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
    <Stack gap="lg">
      <Box
        component="header"
        pb="md"
        style={{ borderBottom: '1px solid var(--app-border)' }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="baseline" gap="md">
            <Text size="sm" c="dimmed">
              {ROLE_LABELS[session.role]}としてログイン中
            </Text>
            <LogoutButton />
          </Group>

          {concert && (
            <ConcertSelector concerts={concerts} selectedId={concert.id} />
          )}

          <Group gap="md" wrap="wrap" component="nav" aria-label="メイン">
            <NavLink to="/" exact>
              ホーム
            </NavLink>
            <NavLink to="/practices">練習日程</NavLink>
            <NavLink to="/pieces">曲・ボウイング</NavLink>
            {session.role === 'admin' && <NavLink to="/admin">管理</NavLink>}
          </Group>
        </Stack>
      </Box>

      {/*
        演奏会が無いときの表示は各画面に任せる。ここで差し替えると、
        演奏会を作る画面にも入れなくなる
      */}
      <Box component="main" className="app-main">
        <Outlet />
      </Box>
    </Stack>
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

type NavLinkProps = {
  to: '/' | '/practices' | '/pieces' | '/admin'
  exact?: boolean
  children: string
}

function NavLink({ to, exact = false, children }: NavLinkProps) {
  return (
    <Anchor
      component={Link}
      to={to}
      activeOptions={{ exact }}
      fw={500}
      underline="hover"
      c="var(--mantine-color-text)"
      style={{
        paddingBottom: 2,
        borderBottom: '2px solid transparent',
      }}
      activeProps={{
        style: {
          borderBottomColor: 'var(--mantine-color-bordeaux-filled)',
          color: 'var(--mantine-color-bordeaux-filled)',
        },
      }}
    >
      {children}
    </Anchor>
  )
}
