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
import { EmptyState } from '../../components/states'
import { forgetConcerts, loadConcerts } from '../../concerts/concert-cache'
import { readRememberedConcert, rememberConcert } from '../../concerts/cookie'
import type { ConcertOption } from '../../concerts/queries'
import { resolveConcertId } from '../../concerts/selection'
import { formatFullDate, todayInJst } from '../../lib/date'

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

const ROLE_LABELS = {
  admin: '管理者',
  extra: 'エキストラ',
} as const

function AuthedLayout() {
  const { session, concerts, concert } = Route.useRouteContext()

  return (
    <>
      <header className="app-header">
        <div className="app-header-account">
          <span>{ROLE_LABELS[session.role]}としてログイン中</span>
          <LogoutButton />
        </div>
        {concert && (
          <ConcertSelector concerts={concerts} selectedId={concert.id} />
        )}
        <nav className="app-nav">
          <Link to="/" activeOptions={{ exact: true }}>
            ホーム
          </Link>
          <Link to="/practices">練習日程</Link>
          <Link to="/pieces">曲・ボウイング</Link>
          {session.role === 'admin' && <Link to="/admin">管理</Link>}
        </nav>
      </header>

      <main>
        {concert ? (
          <Outlet />
        ) : (
          <EmptyState title="まだ公開された演奏会がありません">
            {session.role === 'admin' ? (
              <p>
                <Link to="/admin">管理画面</Link>から演奏会を登録してください。
              </p>
            ) : (
              <p>管理者が登録するまでお待ちください。</p>
            )}
          </EmptyState>
        )}
      </main>
    </>
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
    <label className="field concert-selector" htmlFor="concert-selector">
      演奏会
      <select
        id="concert-selector"
        value={selectedId}
        onChange={(event) => {
          const concert = Number(event.target.value)
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
      </select>
    </label>
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
