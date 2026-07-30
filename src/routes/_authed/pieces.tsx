import { Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { ExternalLink } from '../../components/external-link'
import { ListItem } from '../../components/list-item'
import { OrderBadge } from '../../components/practice-item'
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
        <Stack gap="sm" component="ol" p={0} style={{ listStyle: 'none' }}>
          {pieces.map((piece, index) => (
            <li key={piece.id}>
              <ListItem>
                <Stack gap={4}>
                  <Title order={2} size="h3">
                    <OrderBadge value={index + 1} />{' '}
                    <Text span fw={600}>
                      {piece.title}
                    </Text>
                  </Title>
                  {piece.composer && (
                    <Text size="sm" c="dimmed">
                      {piece.composer}
                    </Text>
                  )}
                  {piece.bowingUrl ? (
                    <ExternalLink href={piece.bowingUrl}>
                      ボウイングを開く
                    </ExternalLink>
                  ) : (
                    <Text size="sm" c="dimmed">
                      ボウイングは未登録です。
                    </Text>
                  )}
                </Stack>
              </ListItem>
            </li>
          ))}
        </Stack>
      )}
    </PageSection>
  )
}
