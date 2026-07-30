import { createFileRoute, redirect } from '@tanstack/react-router'

/** 管理の入口は演奏会。トップに別メニューを置かず導線を一本化する */
export const Route = createFileRoute('/_authed/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/concerts' })
  },
})
