import { Text } from '@mantine/core'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { count } from 'drizzle-orm'
import { requireAdmin } from '../../../auth/middleware'
import { PageSection } from '../../../components/states'
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

const ADMIN_LINKS = [
  { to: '/admin/concerts' as const, label: '演奏会' },
  { to: '/admin/practices' as const, label: '練習' },
  { to: '/admin/pieces' as const, label: '曲' },
  { to: '/admin/venues' as const, label: '会場' },
  { to: '/admin/settings' as const, label: '設定' },
]

function AdminHome() {
  const { concertCount } = Route.useLoaderData()

  return (
    <PageSection title="管理画面" titleOrder={1}>
      <Text c="dimmed" size="sm">
        登録済みの演奏会は {concertCount} 件です。
      </Text>
      <section className="panel" aria-label="管理メニュー">
        {ADMIN_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="panel-row">
            <span>{link.label}</span>
            <span className="panel-row-chevron" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </section>
      <Link to="/" className="panel-row" style={{ marginTop: '0.25rem' }}>
        <span>閲覧画面へ戻る</span>
        <span className="panel-row-chevron" aria-hidden>
          ›
        </span>
      </Link>
    </PageSection>
  )
}
