import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { ExternalLink } from '../../components/external-link'
import { PracticeItem } from '../../components/practice-item'
import { EmptyState } from '../../components/states'
import { getConcertOverview } from '../../concerts/queries'
import { getDb } from '../../db/client'
import { formatFullDate, todayInJst } from '../../lib/date'
import { getNextPractice } from '../../practices/queries'

const getDashboard = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .validator(z.object({ concertId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [concert, nextPractice] = await Promise.all([
      getConcertOverview(db, data.concertId),
      getNextPractice(db, data.concertId, todayInJst()),
    ])

    return { concert, nextPractice }
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
  const data = Route.useLoaderData()
  // 演奏会が1件も無い場合はレイアウトが空状態を出すので、ここは描画されない
  if (!data?.concert) return null

  const { concert, nextPractice } = data

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
