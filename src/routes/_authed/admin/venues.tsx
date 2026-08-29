import { Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useId, useState } from 'react'
import { z } from 'zod'
import { requireAdmin } from '../../../auth/middleware'
import {
  AdminForm,
  Field,
  useAdminAction,
  useAdminForm,
} from '../../../components/admin-form'
import { ConfirmButton } from '../../../components/confirm-button'
import {
  AdminList,
  AdminListItem,
  ControlRow,
  SecondaryButton,
} from '../../../components/control-row'
import { AppTextarea, AppTextInput } from '../../../components/form-controls'
import { EmptyState, PageSection } from '../../../components/states'
import { getDb } from '../../../db/client'
import { MAX_LENGTH } from '../../../lib/limits'
import { idValue, optionalText, requiredText } from '../../../lib/validation'
import { loggedServerFn } from '../../../observability/logged-server-fn'
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

const getVenues = loggedServerFn('getVenues', { method: 'GET' })
  .middleware([requireAdmin])
  .handler(() => listVenues(getDb()))

const addVenue = loggedServerFn('addVenue', { method: 'POST' })
  .middleware([requireAdmin])
  .validator(venueInput)
  .handler(async ({ data }) => {
    await createVenue(getDb(), data)
  })

const editVenue = loggedServerFn('editVenue', { method: 'POST' })
  .middleware([requireAdmin])
  .validator(venueInput.extend({ id: idValue }))
  .handler(({ data: { id, ...input } }) => updateVenue(getDb(), id, input))

const removeVenue = loggedServerFn('removeVenue', { method: 'POST' })
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
    <PageSection title="会場" titleOrder={1}>
      <Text c="dimmed">
        ここに登録した会場を、演奏会と練習の登録で選べるようになります。
      </Text>

      <VenueForm />

      {venues.length === 0 ? (
        <EmptyState
          title="会場はまだ登録されていません"
          description="上のフォームから登録してください。"
        />
      ) : (
        <AdminList>
          {venues.map((venue) => (
            <VenueItem key={venue.id} venue={venue} />
          ))}
        </AdminList>
      )}
    </PageSection>
  )
}

function VenueItem({ venue }: { venue: VenueListItem }) {
  const [editing, setEditing] = useState(false)
  const remove = useServerFn(removeVenue)
  const action = useAdminAction()

  if (editing) {
    return (
      <li>
        <VenueForm venue={venue} onDone={() => setEditing(false)} />
      </li>
    )
  }

  return (
    <AdminListItem>
      <Stack gap={4}>
        <Text fw={600}>{venue.name}</Text>
        <Text size="sm" c="dimmed">
          {venue.address}
        </Text>
        {venue.note && (
          <Text size="sm" c="dimmed">
            {venue.note}
          </Text>
        )}
        <Text size="sm" c="dimmed">
          {usageLabel(venue)}
        </Text>

        <ControlRow failure={action.failure}>
          <SecondaryButton
            aria-label={`「${venue.name}」を編集`}
            onClick={() => setEditing(true)}
          >
            編集
          </SecondaryButton>
          <ConfirmButton
            label="削除"
            labelAriaLabel={`「${venue.name}」を削除`}
            title={`「${venue.name}」を削除しますか？`}
            description={<p>{deleteWarning(venue)}</p>}
            disabled={action.running}
            onConfirm={() =>
              action.run(() => remove({ data: { id: venue.id } }))
            }
          />
        </ControlRow>
      </Stack>
    </AdminListItem>
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
        <AppTextInput
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <Field id={`${id}-address`} label="住所" error={form.errors.address}>
        <AppTextInput
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
        <AppTextarea
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
