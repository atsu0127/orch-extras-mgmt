import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/')({
  component: Dashboard,
})

function Dashboard() {
  const { session } = Route.useRouteContext()

  return (
    <main>
      <h1>エキストラ情報ポータル</h1>
      <p>練習日程と曲の一覧は準備中です。</p>
      {session.role === 'admin' && <Link to="/admin">管理画面へ</Link>}
    </main>
  )
}
