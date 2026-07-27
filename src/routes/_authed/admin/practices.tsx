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
import { EmptyState, NoConcertState } from '../../../components/states'
import { getDb } from '../../../db/client'
import { formatDate, formatTimeRange } from '../../../lib/date'
import { idValue, toOptionalId } from '../../../lib/validation'
import { practiceInput } from '../../../practices/input'
import {
  createPractice,
  deletePractice,
  updatePractice,
} from '../../../practices/mutations'
import {
  listPracticesForAdmin,
  type PracticeAdminItem,
} from '../../../practices/queries'
import { listVenueOptions, type VenueOption } from '../../../venues/queries'

const getPracticesPage = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ concertId: idValue }))
  .handler(async ({ data }) => {
    const db = getDb()
    return {
      practices: await listPracticesForAdmin(db, data.concertId),
      venues: await listVenueOptions(db),
    }
  })

const addPractice = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(practiceInput.extend({ concertId: idValue }))
  .handler(({ data: { concertId, ...fields } }) =>
    createPractice(getDb(), concertId, fields),
  )

const editPractice = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(practiceInput.extend({ id: idValue }))
  .handler(({ data: { id, ...fields } }) => updatePractice(getDb(), id, fields))

const removePractice = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deletePractice(getDb(), data.id))

export const Route = createFileRoute('/_authed/admin/practices')({
  loaderDeps: ({ search }) => ({ concert: search.concert }),
  loader: ({ deps }) =>
    deps.concert === undefined
      ? null
      : getPracticesPage({ data: { concertId: deps.concert } }),
  component: AdminPracticesPage,
})

function AdminPracticesPage() {
  const { session, concert } = Route.useRouteContext()
  const data = Route.useLoaderData()
  if (!data || !concert) return <NoConcertState role={session.role} />

  return (
    <section className="section">
      <h1>練習</h1>
      <p>
        「{concert.name}」の練習です。別の演奏会は上のセレクタで切り替えます。
      </p>

      <PracticeForm concertId={concert.id} venues={data.venues} />

      {data.practices.length === 0 ? (
        <EmptyState
          title="練習はまだ登録されていません"
          description="上のフォームから登録してください。"
        />
      ) : (
        <ul className="list">
          {data.practices.map((practice) => (
            <li key={practice.id}>
              <AdminPracticeItem
                practice={practice}
                concertId={concert.id}
                venues={data.venues}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type AdminPracticeItemProps = {
  practice: PracticeAdminItem
  concertId: number
  venues: ReadonlyArray<VenueOption>
}

function AdminPracticeItem({
  practice,
  concertId,
  venues,
}: AdminPracticeItemProps) {
  const [editing, setEditing] = useState(false)
  const remove = useServerFn(removePractice)
  const action = useAdminAction()

  if (editing) {
    return (
      <PracticeForm
        practice={practice}
        concertId={concertId}
        venues={venues}
        onDone={() => setEditing(false)}
      />
    )
  }

  const venue = venues.find(({ id }) => id === practice.venueId)
  const time = formatTimeRange(practice.startTime, practice.endTime)

  return (
    <div className="item">
      <div className="item-title">
        {formatDate(practice.date)}
        {time && ` ${time}`}
      </div>
      <p className="item-note">{venue ? venue.name : '会場は未設定'}</p>
      {practice.detail && <p className="item-note">{practice.detail}</p>}

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
          title={`${formatDate(practice.date)}の練習を削除しますか？`}
          description={
            <p>付いている録音・録画リンクも一緒に消えます。元に戻せません。</p>
          }
          disabled={action.running}
          onConfirm={() =>
            action.run(() => remove({ data: { id: practice.id } }))
          }
        />
      </div>
      <FormError message={action.failure} />
    </div>
  )
}

type PracticeFormProps = {
  practice?: PracticeAdminItem
  concertId: number
  venues: ReadonlyArray<VenueOption>
  onDone?: () => void
}

function PracticeForm({
  practice,
  concertId,
  venues,
  onDone,
}: PracticeFormProps) {
  const id = useId()
  const add = useServerFn(addPractice)
  const edit = useServerFn(editPractice)
  const [date, setDate] = useState(practice?.date ?? '')
  const [startTime, setStartTime] = useState(practice?.startTime ?? '')
  const [endTime, setEndTime] = useState(practice?.endTime ?? '')
  const [venueId, setVenueId] = useState(String(practice?.venueId ?? ''))
  const [detail, setDetail] = useState(practice?.detail ?? '')

  const form = useAdminForm({
    schema: practiceInput,
    action: (data) =>
      practice
        ? edit({ data: { ...data, id: practice.id } })
        : add({ data: { ...data, concertId } }),
    onSaved: () => {
      if (practice) {
        onDone?.()
        return
      }
      // 時刻と会場はそのまま残す。毎週同じ時間・同じ場所という練習が多く、
      // 続けて登録するときに入れ直さずに済む
      setDate('')
      setDetail('')
    },
  })

  return (
    <AdminForm
      title={practice ? '練習を編集' : '練習を追加'}
      onSubmit={form.onSubmit(() => ({
        date,
        startTime,
        endTime,
        venueId: toOptionalId(venueId),
        detail,
      }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={practice ? onDone : undefined}
    >
      <Field id={`${id}-date`} label="日付" error={form.errors.date}>
        <input
          id={`${id}-date`}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>

      <div className="field-row">
        <Field
          id={`${id}-start`}
          label="開始（任意）"
          error={form.errors.startTime}
        >
          <input
            id={`${id}-start`}
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </Field>

        <Field
          id={`${id}-end`}
          label="終了（任意）"
          error={form.errors.endTime}
        >
          <input
            id={`${id}-end`}
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </Field>
      </div>

      <Field
        id={`${id}-venue`}
        label="会場（任意）"
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
        id={`${id}-detail`}
        label="詳細（任意）"
        hint="分奏の編成、持ち物、集合場所など"
        error={form.errors.detail}
      >
        <textarea
          id={`${id}-detail`}
          rows={3}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}
