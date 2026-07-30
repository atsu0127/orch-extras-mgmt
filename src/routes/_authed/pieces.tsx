import { Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import {
  EmptyState,
  NoConcertState,
  PageSection,
} from '../../components/states'
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
    <PageSection title="曲・ボウイング" titleOrder={1}>
      {pieces.length === 0 ? (
        <EmptyState
          title="曲はまだ登録されていません"
          description="登録されると演奏順に並びます。"
        />
      ) : (
        <section className="panel" aria-label="曲一覧">
          {pieces.map((piece, index) =>
            piece.bowingUrl ? (
              <a
                key={piece.id}
                className="panel-row"
                href={piece.bowingUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ alignItems: 'flex-start' }}
              >
                <span>
                  {index + 1}. {piece.title}
                  <Text span display="block" size="xs" c="dimmed" mt={2}>
                    {piece.composer
                      ? `${piece.composer} · ボウイング`
                      : 'ボウイング'}
                  </Text>
                </span>
                <span className="panel-row-chevron" aria-hidden>
                  ›
                </span>
              </a>
            ) : (
              <div
                key={piece.id}
                className="panel-row"
                style={{ alignItems: 'flex-start', cursor: 'default' }}
              >
                <span>
                  {index + 1}. {piece.title}
                  <Text span display="block" size="xs" c="dimmed" mt={2}>
                    {piece.composer
                      ? `${piece.composer} · 未設定`
                      : 'ボウイング未設定'}
                  </Text>
                </span>
              </div>
            ),
          )}
        </section>
      )}
    </PageSection>
  )
}
