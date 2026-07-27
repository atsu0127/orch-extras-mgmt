import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/pieces')({
  component: PiecesPage,
})

function PiecesPage() {
  return <h1>曲・ボウイング</h1>
}
