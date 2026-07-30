import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { PracticeItem } from '../../components/practice-item'
import { EmptyState, NoConcertState } from '../../components/states'
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
    <section className="section">
      <h1>練習日程</h1>

      {data.practices.length === 0 ? (
        <EmptyState
          title="練習の日程はまだ登録されていません"
          description="登録されるとここに並びます。"
        />
      ) : (
        <>
          <nav className="tabs">
            <Link
              to="/practices"
              search={(prev) => ({ ...prev, view: undefined })}
              className={view === 'upcoming' ? 'is-active' : ''}
            >
              今後（{upcoming.length}）
            </Link>
            <Link
              to="/practices"
              search={(prev) => ({ ...prev, view: 'past' })}
              className={view === 'past' ? 'is-active' : ''}
            >
              過去（{past.length}）
            </Link>
          </nav>

          {shown.length === 0 ? (
            <EmptyState
              title={
                view === 'past'
                  ? '終わった練習はまだありません'
                  : '今後の練習の予定はありません'
              }
            />
          ) : (
            <ul className="list">
              {shown.map((practice) => (
                <li key={practice.id}>
                  <PracticeItem
                    practice={practice}
                    concertName={concert.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
