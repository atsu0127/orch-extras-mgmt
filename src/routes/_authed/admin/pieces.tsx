import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useId, useState } from 'react'
import { z } from 'zod'
import { requireAdmin } from '../../../auth/middleware'
import {
  AdminForm,
  Field,
  FormError,
  useAdminAction,
  useAdminForm,
} from '../../../components/admin-form'
import { ConfirmButton } from '../../../components/confirm-button'
import { ExternalLink } from '../../../components/external-link'
import { EmptyState, NoConcertState } from '../../../components/states'
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
    <section className="section">
      <h1>曲・ボウイング</h1>
      <p>
        「{concert.name}」の曲です。並びがそのまま演奏順として閲覧側に出ます。
      </p>

      <PieceForm concertId={concert.id} />

      {pieces.length === 0 ? (
        <EmptyState
          title="曲はまだ登録されていません"
          description="上のフォームから登録してください。"
        />
      ) : (
        <ol className="list">
          {pieces.map((piece, index) => (
            <li key={piece.id}>
              <PieceItem
                piece={piece}
                concertId={concert.id}
                position={index + 1}
                first={index === 0}
                last={index === pieces.length - 1}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
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
      <PieceForm
        piece={piece}
        concertId={concertId}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="item">
      <div className="item-title">
        <span className="badge">{position}</span>
        <span>{piece.title}</span>
      </div>
      {piece.composer && <p className="item-note">{piece.composer}</p>}
      {piece.bowingUrl ? (
        // 開けるかどうかは実際に踏まないと分からないので、URL の文字列ではなくリンクを出す
        <p>
          <ExternalLink href={piece.bowingUrl}>ボウイングを開く</ExternalLink>
        </p>
      ) : (
        <p className="item-note">ボウイングは未登録</p>
      )}

      <div className="controls">
        <button
          type="button"
          className="secondary"
          aria-label={`「${piece.title}」を前へ`}
          disabled={first || action.running}
          onClick={() =>
            void action.run(() =>
              reorder({ data: { id: piece.id, direction: 'up' } }),
            )
          }
        >
          ↑
        </button>
        <button
          type="button"
          className="secondary"
          aria-label={`「${piece.title}」を後へ`}
          disabled={last || action.running}
          onClick={() =>
            void action.run(() =>
              reorder({ data: { id: piece.id, direction: 'down' } }),
            )
          }
        >
          ↓
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setEditing(true)}
        >
          編集
        </button>
        <ConfirmButton
          label="削除"
          title={`「${piece.title}」を削除しますか？`}
          description={<p>{deleteWarning(piece)}</p>}
          disabled={action.running}
          onConfirm={() => action.run(() => remove({ data: { id: piece.id } }))}
        />
      </div>
      <FormError message={action.failure} />
    </div>
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
    },
  })

  return (
    <AdminForm
      title={piece ? '曲を編集' : '曲を追加'}
      onSubmit={form.onSubmit(() => ({ title, composer, bowingUrl }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={piece ? onDone : undefined}
    >
      <Field id={`${id}-title`} label="曲名" error={form.errors.title}>
        <input
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
        <input
          id={`${id}-composer`}
          value={composer}
          onChange={(event) => setComposer(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-bowing`}
        label="ボウイングURL（任意）"
        hint="1曲に1つ。PDF や共有フォルダのURL"
        error={form.errors.bowingUrl}
      >
        <input
          id={`${id}-bowing`}
          type="url"
          inputMode="url"
          value={bowingUrl}
          onChange={(event) => setBowingUrl(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}

function deleteWarning(piece: PieceEntry): string {
  const base = '元に戻せません。以降の曲は1つ前に繰り上がります。'
  return piece.bowingUrl ? `ボウイングのリンクも一緒に消えます。${base}` : base
}
