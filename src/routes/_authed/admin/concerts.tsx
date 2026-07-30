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
import {
  createConcert,
  deleteConcert,
  setConcertStatus,
  updateConcert,
} from '../../../concerts/mutations'
import {
  type ConcertAdminItem,
  listConcertsForAdmin,
} from '../../../concerts/queries'
import { getDb } from '../../../db/client'
import { CONCERT_STATUSES } from '../../../db/schema'
import { formatFullDate } from '../../../lib/date'
import { MAX_LENGTH } from '../../../lib/limits'
import {
  idValue,
  optionalDate,
  optionalId,
  optionalText,
  optionalUrl,
  requiredText,
  toOptionalId,
} from '../../../lib/validation'
import { listVenueOptions, type VenueOption } from '../../../venues/queries'

const concertInput = z.object({
  name: requiredText(MAX_LENGTH.concertName),
  performanceDate: optionalDate,
  venueId: optionalId,
  attendanceUrl: optionalUrl,
  attendanceNote: optionalText(MAX_LENGTH.attendanceNote),
})

const getConcertsPage = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = getDb()
    return {
      concerts: await listConcertsForAdmin(db),
      venues: await listVenueOptions(db),
    }
  })

const addConcert = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(concertInput)
  .handler(({ data }) => createConcert(getDb(), data))

const editConcert = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(concertInput.extend({ id: idValue }))
  .handler(({ data: { id, ...input } }) => updateConcert(getDb(), id, input))

const changeConcertStatus = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue, status: z.enum(CONCERT_STATUSES) }))
  .handler(({ data }) => setConcertStatus(getDb(), data.id, data.status))

const removeConcert = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deleteConcert(getDb(), data.id))

export const Route = createFileRoute('/_authed/admin/concerts')({
  loader: () => getConcertsPage(),
  component: ConcertsPage,
})

function ConcertsPage() {
  const { concerts, venues } = Route.useLoaderData()

  return (
    <section className="section">
      <h1>演奏会</h1>
      <p>練習と曲は演奏会ごとに登録します。まずここに演奏会を作ります。</p>

      <ConcertForm venues={venues} />

      {concerts.length === 0 ? (
        <EmptyState
          title="演奏会はまだ登録されていません"
          description="上のフォームから登録してください。"
        />
      ) : (
        <ul className="list">
          {concerts.map((concert) => (
            <li key={concert.id}>
              <ConcertItem concert={concert} venues={venues} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type ConcertItemProps = {
  concert: ConcertAdminItem
  venues: ReadonlyArray<VenueOption>
}

function ConcertItem({ concert, venues }: ConcertItemProps) {
  const [editing, setEditing] = useState(false)
  const changeStatus = useServerFn(changeConcertStatus)
  const remove = useServerFn(removeConcert)
  const action = useAdminAction()

  if (editing) {
    return (
      <ConcertForm
        concert={concert}
        venues={venues}
        onDone={() => setEditing(false)}
      />
    )
  }

  const archived = concert.status === 'archived'
  const venue = venues.find(({ id }) => id === concert.venueId)

  return (
    <div className="item">
      <div className="item-title">
        <span>{concert.name}</span>
        {archived && <span className="badge">アーカイブ済み</span>}
      </div>
      <p className="item-note">
        {concert.performanceDate
          ? `本番 ${formatFullDate(concert.performanceDate)}`
          : '本番日は未設定'}
        {venue && ` / ${venue.name}`}
      </p>
      <p className="item-note">
        {concert.attendanceUrl ? '出欠の回答先あり' : '出欠の回答先は未設定'}
        {` / 練習 ${concert.practiceCount} 件 / 曲 ${concert.pieceCount} 件`}
      </p>

      <div className="controls">
        <button
          type="button"
          className="secondary"
          onClick={() => setEditing(true)}
        >
          編集
        </button>
        <button
          type="button"
          className="secondary"
          disabled={action.running}
          onClick={() =>
            void action.run(() =>
              changeStatus({
                data: {
                  id: concert.id,
                  status: archived ? 'active' : 'archived',
                },
              }),
            )
          }
        >
          {archived ? '進行中に戻す' : 'アーカイブする'}
        </button>
        <ConfirmButton
          label="削除"
          title={`「${concert.name}」を削除しますか？`}
          description={<p>{deleteWarning(concert)}</p>}
          disabled={action.running}
          onConfirm={() =>
            action.run(() => remove({ data: { id: concert.id } }))
          }
        />
      </div>
      <FormError message={action.failure} />
    </div>
  )
}

type ConcertFormProps = {
  concert?: ConcertAdminItem
  venues: ReadonlyArray<VenueOption>
  onDone?: () => void
}

function ConcertForm({ concert, venues, onDone }: ConcertFormProps) {
  const id = useId()
  const add = useServerFn(addConcert)
  const edit = useServerFn(editConcert)
  const [name, setName] = useState(concert?.name ?? '')
  const [performanceDate, setPerformanceDate] = useState(
    concert?.performanceDate ?? '',
  )
  const [venueId, setVenueId] = useState(String(concert?.venueId ?? ''))
  const [attendanceUrl, setAttendanceUrl] = useState(
    concert?.attendanceUrl ?? '',
  )
  const [attendanceNote, setAttendanceNote] = useState(
    concert?.attendanceNote ?? '',
  )

  const form = useAdminForm({
    schema: concertInput,
    action: (data) =>
      concert ? edit({ data: { ...data, id: concert.id } }) : add({ data }),
    onSaved: () => {
      if (concert) {
        onDone?.()
        return
      }
      setName('')
      setPerformanceDate('')
      setVenueId('')
      setAttendanceUrl('')
      setAttendanceNote('')
    },
  })

  return (
    <AdminForm
      title={concert ? '演奏会を編集' : '演奏会を追加'}
      onSubmit={form.onSubmit(() => ({
        name,
        performanceDate,
        venueId: toOptionalId(venueId),
        attendanceUrl,
        attendanceNote,
      }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={concert ? onDone : undefined}
    >
      <Field id={`${id}-name`} label="名前" error={form.errors.name}>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-date`}
        label="本番日（任意）"
        error={form.errors.performanceDate}
      >
        <input
          id={`${id}-date`}
          type="date"
          value={performanceDate}
          onChange={(event) => setPerformanceDate(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-venue`}
        label="本番会場（任意）"
        hint={venues.length === 0 ? '会場を登録すると選べます' : undefined}
        error={form.errors.venueId}
      >
        <select
          id={`${id}-venue`}
          value={venueId}
          onChange={(event) => setVenueId(event.target.value)}
        >
          <option value="">未設定</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id={`${id}-attendance-url`}
        label="出欠の回答先 URL（任意）"
        hint="調整さんなど、外部サービスのURL"
        error={form.errors.attendanceUrl}
      >
        <input
          id={`${id}-attendance-url`}
          type="url"
          inputMode="url"
          value={attendanceUrl}
          onChange={(event) => setAttendanceUrl(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-attendance-note`}
        label="出欠の補足（任意）"
        hint="回答期限など"
        error={form.errors.attendanceNote}
      >
        <textarea
          id={`${id}-attendance-note`}
          rows={2}
          value={attendanceNote}
          onChange={(event) => setAttendanceNote(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}

function deleteWarning(concert: ConcertAdminItem): string {
  if (concert.practiceCount + concert.pieceCount === 0) {
    return 'この演奏会に練習と曲は登録されていません。元に戻せません。'
  }

  return `練習 ${concert.practiceCount} 件（付いている録音リンクを含む）と曲 ${concert.pieceCount} 件も一緒に消えます。元に戻せません。残しておくだけならアーカイブを使ってください。`
}
