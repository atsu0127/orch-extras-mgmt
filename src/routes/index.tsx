import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main>
      <h1>エキストラ情報ポータル</h1>
      <p>準備中です。</p>
    </main>
  )
}
