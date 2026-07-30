import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { ExternalLink } from '../../components/external-link'
import { PracticeItem } from '../../components/practice-item'
import { EmptyState, NoConcertState } from '../../components/states'
import { getConcertOverview } from '../../concerts/queries'
import { getDb } from '../../db/client'
import { formatFullDate, todayInJst } from '../../lib/date'
import { buildInquiryMailtoUrl } from '../../lib/external-urls'
import { getNextPractice } from '../../practices/queries'
import { getAppSettings } from '../../settings/queries'

const getDashboard = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .validator(z.object({ concertId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [concert, nextPractice, appSettings] = await Promise.all([
      getConcertOverview(db, data.concertId),
      getNextPractice(db, data.concertId, todayInJst()),
      getAppSettings(db),
    ])

    return { concert, nextPractice, appSettings }
  })

export const Route = createFileRoute('/_authed/')({
  loaderDeps: ({ search }) => ({ concert: search.concert }),
  loader: ({ deps }) =>
    deps.concert === undefined
      ? null
      : getDashboard({ data: { concertId: deps.concert } }),
  component: Dashboard,
})

function Dashboard() {
  const { session } = Route.useRouteContext()
  const data = Route.useLoaderData()
  if (!data?.concert) return <NoConcertState role={session.role} />

  const { concert, nextPractice, appSettings } = data

  return (
    <>
      <section className="section">
        <h1>{concert.name}</h1>
        {concert.performanceDate && (
          <p>
            本番 {formatFullDate(concert.performanceDate)}
            {concert.venueName && ` / ${concert.venueName}`}
          </p>
        )}
      </section>

      <section className="section">
        <h2>出欠の回答</h2>
        {concert.attendanceUrl ? (
          <div className="stack">
            <ExternalLink href={concert.attendanceUrl} className="action">
              出欠を回答する
            </ExternalLink>
            {concert.attendanceNote && <p>{concert.attendanceNote}</p>}
          </div>
        ) : (
          <EmptyState
            title="出欠の回答先はまだ設定されていません"
            description="決まり次第ここに表示されます。"
          />
        )}
      </section>

      {appSettings.adminEmail && (
        <section className="section">
          <h2>問い合わせ</h2>
          <a
            href={buildInquiryMailtoUrl(appSettings.adminEmail, concert.name)}
            className="action"
          >
            管理者へ問い合わせる
          </a>
        </section>
      )}

      <section className="section">
        <h2>次の練習</h2>
        {nextPractice ? (
          <PracticeItem practice={nextPractice} />
        ) : (
          <EmptyState
            title="今後の練習の予定はありません"
            description="終わった練習は日程一覧から見られます。"
          />
        )}
      </section>

      <nav className="stack">
        <Link to="/practices" className="action">
          練習日程をすべて見る
        </Link>
        <Link to="/pieces" className="action">
          曲とボウイングを見る
        </Link>
      </nav>
    </>
  )
}
