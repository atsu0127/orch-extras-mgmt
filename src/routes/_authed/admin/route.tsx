import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: ({ context }) => {
    if (context.session.role !== 'admin') throw redirect({ to: '/' })
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <>
      <nav className="admin-subnav" aria-label="管理">
        <AdminNavLink to="/admin" exact>
          管理トップ
        </AdminNavLink>
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
    | '/admin'
    | '/admin/concerts'
    | '/admin/practices'
    | '/admin/pieces'
    | '/admin/venues'
    | '/admin/settings'
  exact?: boolean
  children: string
}

function AdminNavLink({ to, exact = false, children }: AdminNavLinkProps) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      activeProps={{ 'data-active': 'true' }}
      inactiveProps={{ 'data-active': 'false' }}
    >
      {children}
    </Link>
  )
}
