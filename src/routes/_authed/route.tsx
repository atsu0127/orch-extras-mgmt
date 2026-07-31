import { Box, Button, NativeSelect } from '@mantine/core'
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  retainSearchParams,
  useNavigate,
  useRouter,
  useRouterState,
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

const ADMIN_DESKTOP_LINKS = [
  { to: '/admin/concerts' as const, label: '演奏会' },
  { to: '/admin/practices' as const, label: '練習の編集' },
  { to: '/admin/pieces' as const, label: '曲の編集' },
  { to: '/admin/venues' as const, label: '会場' },
  { to: '/admin/settings' as const, label: '設定' },
]

type AppPath =
  | '/'
  | '/practices'
  | '/pieces'
  | '/admin/concerts'
  | '/admin/practices'
  | '/admin/pieces'
  | '/admin/venues'
  | '/admin/settings'

function AuthedLayout() {
  const { session, concerts, concert } = Route.useRouteContext()
  const showAdmin = session.role === 'admin'
  const isAdminPath = useRouterState({
    select: (state) => state.location.pathname.startsWith('/admin'),
  })

  return (
    <div className={`app-frame${isAdminPath ? ' app-frame--admin' : ''}`}>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-bar">
            <span className="app-brand">エキストラ情報ポータル</span>
            <div className="app-header-actions">
              <span className="app-role">
                {ROLE_LABELS[session.role]}としてログイン中
              </span>
              <LogoutButton />
            </div>
          </div>

          {/*
            PC の管理中は閲覧タブを隠して管理セクションを1段に載せる。
            モバイルは下部ナビ＋サブナビのまま（admin/route.tsx）。
          */}
          <nav className="app-desktop-nav" aria-label="メイン">
            {isAdminPath && showAdmin ? (
              <>
                <DesktopLink to="/" exact>
                  閲覧へ
                </DesktopLink>
                {ADMIN_DESKTOP_LINKS.map((link) => (
                  <DesktopLink key={link.to} to={link.to}>
                    {link.label}
                  </DesktopLink>
                ))}
              </>
            ) : (
              <>
                <DesktopLink to="/" exact>
                  ホーム
                </DesktopLink>
                <DesktopLink to="/practices">練習</DesktopLink>
                <DesktopLink to="/pieces">曲</DesktopLink>
                {showAdmin && (
                  <AdminEntryLink variant="desktop">管理</AdminEntryLink>
                )}
              </>
            )}
          </nav>

          {concert && (
            <div className="app-concert-select">
              <ConcertSelector concerts={concerts} selectedId={concert.id} />
            </div>
          )}
        </div>
      </header>

      {/*
        演奏会が無いときの表示は各画面に任せる。ここで差し替えると、
        演奏会を作る画面にも入れなくなる
      */}
      <Box
        component="main"
        className={`app-main${isAdminPath ? ' app-main--admin' : ''}`}
      >
        <Outlet />
      </Box>

      <nav className="app-bottom-nav" aria-label="メイン">
        <BottomLink to="/" exact label="ホーム" ariaLabel="ホーム">
          <HomeIcon />
        </BottomLink>
        <BottomLink to="/practices" label="練習" ariaLabel="練習日程">
          <CalendarIcon />
        </BottomLink>
        <BottomLink to="/pieces" label="曲" ariaLabel="曲・ボウイング">
          <MusicIcon />
        </BottomLink>
        {showAdmin && (
          <AdminEntryLink variant="bottom">
            <AdminIcon />
          </AdminEntryLink>
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

/** /admin/* 全体を選択中にする管理入口。to は演奏会（リダイレクトを避ける） */
function AdminEntryLink({
  variant,
  children,
}: {
  variant: 'desktop' | 'bottom'
  children: ReactNode
}) {
  const active = useRouterState({
    select: (state) => state.location.pathname.startsWith('/admin'),
  })

  if (variant === 'bottom') {
    return (
      <Link
        to="/admin/concerts"
        aria-label="管理"
        data-active={active ? 'true' : 'false'}
      >
        {children}
        <span aria-hidden="true">管理</span>
      </Link>
    )
  }

  return (
    <Link to="/admin/concerts" data-active={active ? 'true' : 'false'}>
      {children}
    </Link>
  )
}

type BottomLinkProps = {
  to: AppPath
  exact?: boolean
  label: string
  ariaLabel: string
  children: ReactNode
}

function BottomLink({
  to,
  exact = false,
  label,
  ariaLabel,
  children,
}: BottomLinkProps) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      aria-label={ariaLabel}
      // data-active で見た目を切り替える。activeProps の型が Mantine 非依存の Link 向き
      activeProps={{ 'data-active': 'true' }}
      inactiveProps={{ 'data-active': 'false' }}
    >
      {children}
      <span aria-hidden="true">{label}</span>
    </Link>
  )
}

function DesktopLink({
  to,
  exact = false,
  children,
}: {
  to: AppPath
  exact?: boolean
  children: string
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      // 下部ナビと同じく data-active で切り替える。style の activeProps は
      // 非アクティブ時に下線が残ることがある（ADR-0019）
      activeProps={{ 'data-active': 'true' }}
      inactiveProps={{ 'data-active': 'false' }}
    >
      {children}
    </Link>
  )
}

/** 装飾アイコン。ラベルは親リンクの aria-label / 可視テキストが担う */
function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="5" width="16" height="15" rx="1" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="16" r="2.5" />
    </svg>
  )
}

function AdminIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
    </svg>
  )
}
