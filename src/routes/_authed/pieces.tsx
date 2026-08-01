import { Text } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
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
import { listPiecesForConcert, type PieceEntry } from '../../pieces/queries'

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
          {pieces.map((piece, index) => (
            <PieceRow key={piece.id} piece={piece} position={index + 1} />
          ))}
        </section>
      )}
    </PageSection>
  )
}

type PieceRowProps = {
  piece: PieceEntry
  position: number
}

function PieceRow({ piece, position }: PieceRowProps) {
  const links = [
    piece.bowingUrl
      ? { href: piece.bowingUrl, label: 'ボウイングあり' as const }
      : null,
    piece.scoreWithoutBowingUrl
      ? {
          href: piece.scoreWithoutBowingUrl,
          label: 'ボウイングなし' as const,
        }
      : null,
  ].filter(
    (
      link,
    ): link is { href: string; label: 'ボウイングあり' | 'ボウイングなし' } =>
      link !== null,
  )

  return (
    <div
      className="panel-row"
      style={{
        alignItems: 'flex-start',
        cursor: 'default',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span>
        {position}. {piece.title}
        {piece.composer ? (
          <Text span display="block" size="xs" c="dimmed" mt={2}>
            {piece.composer}
          </Text>
        ) : null}
      </span>
      {links.length === 0 ? (
        <Text size="xs" c="dimmed">
          楽譜リンク未設定
        </Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 'var(--mantine-font-size-sm)',
              }}
            >
              {link.label}
              <IconExternalLink size={16} stroke={1.75} aria-hidden />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
