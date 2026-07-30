import { Anchor, Group, Stack } from '@mantine/core'
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: ({ context }) => {
    if (context.session.role !== 'admin') throw redirect({ to: '/' })
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <Stack gap="lg">
      <Group gap="md" wrap="wrap" component="nav" aria-label="管理">
        <AdminNavLink to="/admin" exact>
          管理トップ
        </AdminNavLink>
        <AdminNavLink to="/admin/concerts">演奏会</AdminNavLink>
        <AdminNavLink to="/admin/practices">練習</AdminNavLink>
        <AdminNavLink to="/admin/pieces">曲</AdminNavLink>
        <AdminNavLink to="/admin/venues">会場</AdminNavLink>
        <AdminNavLink to="/admin/settings">設定</AdminNavLink>
      </Group>
      <Outlet />
    </Stack>
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
    <Anchor
      component={Link}
      to={to}
      activeOptions={{ exact }}
      fw={500}
      underline="hover"
      c="var(--mantine-color-text)"
      style={{
        paddingBottom: 2,
        borderBottom: '2px solid transparent',
      }}
      activeProps={{
        style: {
          borderBottomColor: 'var(--mantine-color-bordeaux-filled)',
          color: 'var(--mantine-color-bordeaux-filled)',
        },
      }}
    >
      {children}
    </Anchor>
  )
}
