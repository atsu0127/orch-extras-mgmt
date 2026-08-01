import { Group, Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useId, useState } from 'react'
import { z } from 'zod'
import { requireAdmin } from '../../../auth/middleware'
import {
  AdminForm,
  Field,
  useAdminAction,
  useAdminForm,
} from '../../../components/admin-form'
import { AdminRowActions } from '../../../components/admin-row-actions'
import { AdminList, AdminListItem } from '../../../components/control-row'
import { ExternalLink } from '../../../components/external-link'
import { AppTextInput } from '../../../components/form-controls'
import { OrderBadge } from '../../../components/practice-item'
import {
  EmptyState,
  NoConcertState,
  PageSection,
} from '../../../components/states'
import { getDb } from '../../../db/client'
import { MAX_LENGTH } from '../../../lib/limits'
import { DIRECTIONS } from '../../../lib/ordering'
import {
  idValue,
  optionalText,
  optionalUrl,
  requiredText,
} from '../../../lib/validation'
import {
  createPiece,
  deletePiece,
  movePiece,
  updatePiece,
} from '../../../pieces/mutations'
import { listPiecesForConcert, type PieceEntry } from '../../../pieces/queries'

const pieceInput = z.object({
  title: requiredText(MAX_LENGTH.pieceTitle),
  composer: optionalText(MAX_LENGTH.pieceComposer),
  bowingUrl: optionalUrl,
  scoreWithoutBowingUrl: optionalUrl,
})

const getPieces = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ concertId: idValue }))
  .handler(({ data }) => listPiecesForConcert(getDb(), data.concertId))

const addPiece = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(pieceInput.extend({ concertId: idValue }))
  .handler(({ data: { concertId, ...fields } }) =>
    createPiece(getDb(), concertId, fields),
  )

const editPiece = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(pieceInput.extend({ id: idValue }))
  .handler(({ data: { id, ...fields } }) => updatePiece(getDb(), id, fields))

const reorderPiece = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue, direction: z.enum(DIRECTIONS) }))
  .handler(({ data }) => movePiece(getDb(), data.id, data.direction))

const removePiece = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deletePiece(getDb(), data.id))

/** 演奏会を切り替えたとき追加フォームの入力を残さない（AGENTS.md） */
export function pieceCreateFormKey(concertId: number): string {
  return String(concertId)
}

export const Route = createFileRoute('/_authed/admin/pieces')({
  loaderDeps: ({ search }) => ({ concert: search.concert }),
  loader: ({ deps }) =>
    deps.concert === undefined
      ? null
      : getPieces({ data: { concertId: deps.concert } }),
  component: AdminPiecesPage,
})

function AdminPiecesPage() {
  const { session, concert } = Route.useRouteContext()
  const pieces = Route.useLoaderData()
  if (!pieces || !concert) return <NoConcertState role={session.role} />

  return (
    <PageSection title="曲・ボウイング" titleOrder={1}>
      <Text c="dimmed">
        「{concert.name}」の曲です。並びがそのまま演奏順として閲覧側に出ます。
      </Text>

      <PieceForm key={pieceCreateFormKey(concert.id)} concertId={concert.id} />

      {pieces.length === 0 ? (
        <EmptyState
          title="曲はまだ登録されていません"
          description="上のフォームから登録してください。"
        />
      ) : (
        <AdminList>
          {pieces.map((piece, index) => (
            <PieceItem
              key={piece.id}
              piece={piece}
              concertId={concert.id}
              position={index + 1}
              first={index === 0}
              last={index === pieces.length - 1}
            />
          ))}
        </AdminList>
      )}
    </PageSection>
  )
}

type PieceItemProps = {
  piece: PieceEntry
  concertId: number
  position: number
  first: boolean
  last: boolean
}

function PieceItem({
  piece,
  concertId,
  position,
  first,
  last,
}: PieceItemProps) {
  const [editing, setEditing] = useState(false)
  const reorder = useServerFn(reorderPiece)
  const remove = useServerFn(removePiece)
  const action = useAdminAction()

  if (editing) {
    return (
      <li>
        <PieceForm
          piece={piece}
          concertId={concertId}
          onDone={() => setEditing(false)}
        />
      </li>
    )
  }

  const hasWith = Boolean(piece.bowingUrl)
  const hasWithout = Boolean(piece.scoreWithoutBowingUrl)

  return (
    <AdminListItem>
      <Stack gap={4}>
        <Group gap="sm" align="center">
          <OrderBadge value={position} />
          <Text fw={600}>{piece.title}</Text>
        </Group>
        {piece.composer && (
          <Text size="sm" c="dimmed">
            {piece.composer}
          </Text>
        )}
        {hasWith && piece.bowingUrl ? (
          <Text size="sm">
            <ExternalLink href={piece.bowingUrl}>
              ボウイングありの楽譜を開く
            </ExternalLink>
          </Text>
        ) : null}
        {hasWithout && piece.scoreWithoutBowingUrl ? (
          <Text size="sm">
            <ExternalLink href={piece.scoreWithoutBowingUrl}>
              ボウイングなしの楽譜を開く
            </ExternalLink>
          </Text>
        ) : null}
        {!hasWith && !hasWithout ? (
          <Text size="sm" c="dimmed">
            楽譜リンクは未登録
          </Text>
        ) : null}

        <AdminRowActions
          failure={action.failure}
          disabled={action.running}
          onEdit={() => setEditing(true)}
          onMoveUp={() =>
            void action.run(() =>
              reorder({ data: { id: piece.id, direction: 'up' } }),
            )
          }
          onMoveDown={() =>
            void action.run(() =>
              reorder({ data: { id: piece.id, direction: 'down' } }),
            )
          }
          canMoveUp={!first}
          canMoveDown={!last}
          moveUpLabel={`「${piece.title}」を前へ`}
          moveDownLabel={`「${piece.title}」を後へ`}
          deleteTitle={`「${piece.title}」を削除しますか？`}
          deleteDescription={<p>{deleteWarning(piece)}</p>}
          onDelete={() => action.run(() => remove({ data: { id: piece.id } }))}
        />
      </Stack>
    </AdminListItem>
  )
}

type PieceFormProps = {
  piece?: PieceEntry
  concertId: number
  onDone?: () => void
}

function PieceForm({ piece, concertId, onDone }: PieceFormProps) {
  const id = useId()
  const add = useServerFn(addPiece)
  const edit = useServerFn(editPiece)
  const [title, setTitle] = useState(piece?.title ?? '')
  const [composer, setComposer] = useState(piece?.composer ?? '')
  const [bowingUrl, setBowingUrl] = useState(piece?.bowingUrl ?? '')
  const [scoreWithoutBowingUrl, setScoreWithoutBowingUrl] = useState(
    piece?.scoreWithoutBowingUrl ?? '',
  )

  const form = useAdminForm({
    schema: pieceInput,
    action: (data) =>
      piece
        ? edit({ data: { ...data, id: piece.id } })
        : add({ data: { ...data, concertId } }),
    onSaved: () => {
      if (piece) {
        onDone?.()
        return
      }
      setTitle('')
      setComposer('')
      setBowingUrl('')
      setScoreWithoutBowingUrl('')
    },
  })

  return (
    <AdminForm
      title={piece ? '曲を編集' : '曲を追加'}
      onSubmit={form.onSubmit(() => ({
        title,
        composer,
        bowingUrl,
        scoreWithoutBowingUrl,
      }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={piece ? onDone : undefined}
    >
      <Field id={`${id}-title`} label="曲名" error={form.errors.title}>
        <AppTextInput
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-composer`}
        label="作曲者（任意）"
        error={form.errors.composer}
      >
        <AppTextInput
          id={`${id}-composer`}
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-bowing`}
        label="ボウイングありの楽譜 URL（任意）"
        hint="PDF や共有フォルダのURL"
        error={form.errors.bowingUrl}
      >
        <AppTextInput
          id={`${id}-bowing`}
          type="url"
          inputMode="url"
          value={bowingUrl}
          onChange={(event) => setBowingUrl(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-score-without`}
        label="ボウイングなしの楽譜 URL（任意）"
        hint="PDF や共有フォルダのURL"
        error={form.errors.scoreWithoutBowingUrl}
      >
        <AppTextInput
          id={`${id}-score-without`}
          type="url"
          inputMode="url"
          value={scoreWithoutBowingUrl}
          onChange={(event) => setScoreWithoutBowingUrl(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}

function deleteWarning(piece: PieceEntry): string {
  const base = '元に戻せません。以降の曲は1つ前に繰り上がります。'
  const hasLink = Boolean(piece.bowingUrl || piece.scoreWithoutBowingUrl)
  return hasLink ? `楽譜のリンクも一緒に消えます。${base}` : base
}
