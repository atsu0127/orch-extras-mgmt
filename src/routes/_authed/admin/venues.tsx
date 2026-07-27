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
import { EmptyState } from '../../../components/states'
import { getDb } from '../../../db/client'
import { MAX_LENGTH } from '../../../lib/limits'
import { idValue, optionalText, requiredText } from '../../../lib/validation'
import {
  createVenue,
  deleteVenue,
  updateVenue,
} from '../../../venues/mutations'
import { listVenues, type VenueListItem } from '../../../venues/queries'

const venueInput = z.object({
  name: requiredText(MAX_LENGTH.venueName),
  address: requiredText(MAX_LENGTH.venueAddress),
  note: optionalText(MAX_LENGTH.venueNote),
})

const getVenues = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(() => listVenues(getDb()))

const addVenue = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(venueInput)
  .handler(({ data }) => createVenue(getDb(), data))

const editVenue = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(venueInput.extend({ id: idValue }))
  .handler(({ data: { id, ...input } }) => updateVenue(getDb(), id, input))

const removeVenue = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deleteVenue(getDb(), data.id))

export const Route = createFileRoute('/_authed/admin/venues')({
  loader: () => getVenues(),
  component: VenuesPage,
})

function VenuesPage() {
  const venues = Route.useLoaderData()

  return (
    <section className="section">
      <h1>会場</h1>
      <p>ここに登録した会場を、演奏会と練習の登録で選べるようになります。</p>

      <VenueForm />

      {venues.length === 0 ? (
        <EmptyState
          title="会場はまだ登録されていません"
          description="上のフォームから登録してください。"
        />
      ) : (
        <ul className="list">
          {venues.map((venue) => (
            <li key={venue.id}>
              <VenueItem venue={venue} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VenueItem({ venue }: { venue: VenueListItem }) {
  const [editing, setEditing] = useState(false)
  const remove = useServerFn(removeVenue)
  const action = useAdminAction()

  if (editing)
    return <VenueForm venue={venue} onDone={() => setEditing(false)} />

  return (
    <div className="item">
      <div className="item-title">{venue.name}</div>
      <p className="item-note">{venue.address}</p>
      {venue.note && <p className="item-note">{venue.note}</p>}
      <p className="item-note">{usageLabel(venue)}</p>

      <div className="controls">
        <button
          type="button"
          className="secondary"
          onClick={() => setEditing(true)}
        >
          編集
        </button>
        <ConfirmButton
          label="削除"
          title={`「${venue.name}」を削除しますか？`}
          description={<p>{deleteWarning(venue)}</p>}
          disabled={action.running}
          onConfirm={() => action.run(() => remove({ data: { id: venue.id } }))}
        />
      </div>
      <FormError message={action.failure} />
    </div>
  )
}

type VenueFormProps = {
  venue?: VenueListItem
  onDone?: () => void
}

function VenueForm({ venue, onDone }: VenueFormProps) {
  const id = useId()
  const add = useServerFn(addVenue)
  const edit = useServerFn(editVenue)
  const [name, setName] = useState(venue?.name ?? '')
  const [address, setAddress] = useState(venue?.address ?? '')
  const [note, setNote] = useState(venue?.note ?? '')

  const form = useAdminForm({
    schema: venueInput,
    action: (data) =>
      venue ? edit({ data: { ...data, id: venue.id } }) : add({ data }),
    onSaved: () => {
      if (venue) {
        onDone?.()
        return
      }
      setName('')
      setAddress('')
      setNote('')
    },
  })

  return (
    <AdminForm
      title={venue ? '会場を編集' : '会場を追加'}
      onSubmit={form.onSubmit(() => ({ name, address, note }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={venue ? onDone : undefined}
    >
      <Field id={`${id}-name`} label="名前" error={form.errors.name}>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <Field id={`${id}-address`} label="住所" error={form.errors.address}>
        <input
          id={`${id}-address`}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-note`}
        label="補足（任意）"
        hint="最寄り駅、入館方法など"
        error={form.errors.note}
      >
        <textarea
          id={`${id}-note`}
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}

function usageLabel(venue: VenueListItem): string {
  const parts: Array<string> = []
  if (venue.concertCount > 0) parts.push(`本番 ${venue.concertCount} 件`)
  if (venue.practiceCount > 0) parts.push(`練習 ${venue.practiceCount} 件`)

  return parts.length === 0
    ? 'まだ使われていません'
    : `使用中 ${parts.join(' / ')}`
}

function deleteWarning(venue: VenueListItem): string {
  return venue.concertCount + venue.practiceCount === 0
    ? 'この会場を使っている演奏会と練習はありません。'
    : 'この会場を使っている演奏会と練習は残りますが、会場が未設定になります。'
}
