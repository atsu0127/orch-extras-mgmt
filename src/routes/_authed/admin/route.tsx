import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: ({ context }) => {
    if (context.session.role !== 'admin') throw redirect({ to: '/' })
  },
  component: AdminLayout,
})

/**
 * モバイル向けの管理内ナビ。
 * PC ではヘッダに管理セクションを載せるため、このサブナビは隠す（styles.css）。
 * ラベルは閲覧側の「練習」「曲」と区別する。
 */
function AdminLayout() {
  return (
    <>
      <nav className="admin-subnav" aria-label="管理">
        <AdminNavLink to="/admin/concerts">演奏会</AdminNavLink>
        <AdminNavLink to="/admin/practices">練習の編集</AdminNavLink>
        <AdminNavLink to="/admin/pieces">曲の編集</AdminNavLink>
        <AdminNavLink to="/admin/venues">会場</AdminNavLink>
        <AdminNavLink to="/admin/settings">設定</AdminNavLink>
      </nav>
      <Outlet />
    </>
  )
}

type AdminNavLinkProps = {
  to:
    | '/admin/concerts'
    | '/admin/practices'
    | '/admin/pieces'
    | '/admin/venues'
    | '/admin/settings'
  children: string
}

function AdminNavLink({ to, children }: AdminNavLinkProps) {
  return (
    <Link
      to={to}
      activeProps={{ 'data-active': 'true' }}
      inactiveProps={{ 'data-active': 'false' }}
    >
      {children}
    </Link>
  )
}
