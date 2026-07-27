import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/practices')({
  component: PracticesPage,
})

function PracticesPage() {
  return <h1>練習日程</h1>
}
