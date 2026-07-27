import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/')({
  component: Dashboard,
})

function Dashboard() {
  const { concert } = Route.useRouteContext()

  return (
    <>
      <h1>{concert?.name}</h1>
      <p>次の練習と出欠の回答先は準備中です。</p>
    </>
  )
}
