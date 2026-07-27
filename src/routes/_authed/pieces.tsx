import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { ExternalLink } from '../../components/external-link'
import { EmptyState, NoConcertState } from '../../components/states'
import { getDb } from '../../db/client'
import { listPiecesForConcert } from '../../pieces/queries'

const listPieces = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .validator(z.object({ concertId: z.number().int().positive() }))
  .handler(({ data }) => listPiecesForConcert(getDb(), data.concertId))

export const Route = createFileRoute('/_authed/pieces')({
  loaderDeps: ({ search }) => ({ concert: search.concert }),
  loader: ({ deps }) =>
    deps.concert === undefined
      ? null
      : listPieces({ data: { concertId: deps.concert } }),
  component: PiecesPage,
})

function PiecesPage() {
  const { session } = Route.useRouteContext()
  const pieces = Route.useLoaderData()
  if (!pieces) return <NoConcertState role={session.role} />

  return (
    <section className="section">
      <h1>曲・ボウイング</h1>

      {pieces.length === 0 ? (
        <EmptyState
          title="曲はまだ登録されていません"
          description="登録されると演奏順に並びます。"
        />
      ) : (
        <ol className="list">
          {pieces.map((piece, index) => (
            <li key={piece.id} className="item">
              <div className="item-title">
                <span className="badge">{index + 1}</span>
                <span>{piece.title}</span>
              </div>
              {piece.composer && <p className="item-note">{piece.composer}</p>}
              {piece.bowingUrl ? (
                <p>
                  <ExternalLink href={piece.bowingUrl}>
                    ボウイングを開く
                  </ExternalLink>
                </p>
              ) : (
                <p className="item-note">ボウイングは未登録です。</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
