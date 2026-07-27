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
      <nav className="app-nav subnav">
        <Link to="/admin" activeOptions={{ exact: true }}>
          管理トップ
        </Link>
        <Link to="/admin/concerts">演奏会</Link>
        <Link to="/admin/practices">練習</Link>
        <Link to="/admin/venues">会場</Link>
      </nav>
      <Outlet />
    </>
  )
}
