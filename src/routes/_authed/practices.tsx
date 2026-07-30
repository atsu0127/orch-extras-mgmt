import { Group, Stack } from '@mantine/core'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { PracticeItem } from '../../components/practice-item'
import {
  EmptyState,
  NoConcertState,
  PageSection,
} from '../../components/states'
import { getDb } from '../../db/client'
import { todayInJst } from '../../lib/date'
import { listPracticesWithMedia } from '../../practices/queries'
import { PRACTICE_VIEWS, splitPractices } from '../../practices/schedule'

const listPractices = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .validator(z.object({ concertId: z.number().int().positive() }))
  .handler(async ({ data }) => ({
    practices: await listPracticesWithMedia(getDb(), data.concertId),
    // 端末の時計に左右されないよう、今後・過去の境目はサーバの時刻で決める
    today: todayInJst(),
  }))

export const Route = createFileRoute('/_authed/practices')({
  validateSearch: z.object({
    view: z.enum(PRACTICE_VIEWS).optional(),
  }),
  loaderDeps: ({ search }) => ({ concert: search.concert }),
  loader: ({ deps }) =>
    deps.concert === undefined
      ? null
      : listPractices({ data: { concertId: deps.concert } }),
  component: PracticesPage,
})

function PracticesPage() {
  const { session, concert } = Route.useRouteContext()
  const data = Route.useLoaderData()
  const { view = 'upcoming' } = Route.useSearch()
  if (!data || !concert) return <NoConcertState role={session.role} />

  const { upcoming, past } = splitPractices(data.practices, data.today)
  const shown = view === 'past' ? past : upcoming

  return (
    <PageSection title="練習日程" titleOrder={1}>
      {data.practices.length === 0 ? (
        <EmptyState
          title="練習の日程はまだ登録されていません"
          description="登録されるとここに並びます。"
        />
      ) : (
        <>
          <Group grow gap="sm" component="nav" aria-label="練習の表示切替">
            <Link
              to="/practices"
              search={(prev) => ({ ...prev, view: undefined })}
              style={viewTabStyle(view === 'upcoming')}
            >
              今後（{upcoming.length}）
            </Link>
            <Link
              to="/practices"
              search={(prev) => ({ ...prev, view: 'past' as const })}
              style={viewTabStyle(view === 'past')}
            >
              過去（{past.length}）
            </Link>
          </Group>

          {shown.length === 0 ? (
            <EmptyState
              title={
                view === 'past'
                  ? '終わった練習はまだありません'
                  : '今後の練習の予定はありません'
              }
            />
          ) : (
            <Stack gap="sm" component="ul" p={0} style={{ listStyle: 'none' }}>
              {shown.map((practice) => (
                <li key={practice.id}>
                  <PracticeItem
                    practice={practice}
                    concertName={concert.name}
                  />
                </li>
              ))}
            </Stack>
          )}
        </>
      )}
    </PageSection>
  )
}

function viewTabStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? 'var(--mantine-color-bordeaux-filled)' : 'var(--app-border)'}`,
    borderRadius: 'var(--mantine-radius-sm)',
    textDecoration: 'none',
    minHeight: '2.75rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem 1rem',
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--mantine-color-bordeaux-filled)' : 'var(--app-muted)',
    background: active ? 'var(--app-surface)' : 'transparent',
  }
}
