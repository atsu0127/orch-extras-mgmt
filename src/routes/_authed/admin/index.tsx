import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { count } from 'drizzle-orm'
import { requireAdmin } from '../../../auth/middleware'
import { getDb } from '../../../db/client'
import { concerts } from '../../../db/schema'

const getAdminOverview = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const [row] = await getDb().select({ total: count() }).from(concerts)
    return { concertCount: row?.total ?? 0 }
  })

export const Route = createFileRoute('/_authed/admin/')({
  loader: () => getAdminOverview(),
  component: AdminHome,
})

function AdminHome() {
  const { concertCount } = Route.useLoaderData()

  return (
    <main>
      <h1>管理画面</h1>
      <p>登録済みの演奏会は {concertCount} 件です。</p>
      <Link to="/">閲覧画面へ戻る</Link>
    </main>
  )
}
