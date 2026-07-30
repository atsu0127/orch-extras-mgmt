import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: ({ context }) => {
    if (context.session.role !== 'admin') throw redirect({ to: '/' })
  },
  component: AdminLayout,
})

/**
 * 管理の画面切替はこのサブナビだけにする。
 * 管理トップの一覧メニューと二重にしない（PC/モバイル共通）。
 */
function AdminLayout() {
  return (
    <>
      <nav className="admin-subnav" aria-label="管理">
        <AdminNavLink to="/admin/concerts">演奏会</AdminNavLink>
        <AdminNavLink to="/admin/practices">練習</AdminNavLink>
        <AdminNavLink to="/admin/pieces">曲</AdminNavLink>
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
