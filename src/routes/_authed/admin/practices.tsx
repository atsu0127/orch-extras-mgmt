import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useEffect, useId, useRef, useState } from 'react'
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
import { formatDate, formatTimeRange } from '../../../lib/date'
import { MAX_LENGTH } from '../../../lib/limits'
import { DIRECTIONS } from '../../../lib/ordering'
import {
  idValue,
  requiredText,
  requiredUrl,
  toOptionalId,
} from '../../../lib/validation'
import {
  duplicatePracticeValues,
  type PracticeFormValues,
} from '../../../practices/duplicate'
import { practiceInput } from '../../../practices/input'
import {
  createPractice,
  createPracticeMedia,
  deletePractice,
  deletePracticeMedia,
  movePracticeMedia,
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

const mediaInput = z.object({
  title: requiredText(MAX_LENGTH.mediaTitle),
  url: requiredUrl,
})

const addMedia = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(mediaInput.extend({ practiceId: idValue }))
  .handler(({ data: { practiceId, ...fields } }) =>
    createPracticeMedia(getDb(), practiceId, fields),
  )

const moveMedia = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue, direction: z.enum(DIRECTIONS) }))
  .handler(({ data }) => movePracticeMedia(getDb(), data.id, data.direction))

const removeMedia = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deletePracticeMedia(getDb(), data.id))

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
  const [duplicateValues, setDuplicateValues] = useState<PracticeFormValues>()
  const [duplicateRevision, setDuplicateRevision] = useState(0)
  const newFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!duplicateValues) return

    newFormRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
    newFormRef.current
      ?.querySelector<HTMLInputElement>('input[type="date"]')
      ?.focus()
  }, [duplicateValues])

  if (!data || !concert) return <NoConcertState role={session.role} />

  const duplicate = (practice: PracticeAdminItem) => {
    setDuplicateValues(duplicatePracticeValues(practice))
    setDuplicateRevision((revision) => revision + 1)
  }

  return (
    <section className="section">
      <h1>練習</h1>
      <p>
        「{concert.name}」の練習です。別の演奏会は上のセレクタで切り替えます。
      </p>

      <div ref={newFormRef}>
        <PracticeForm
          key={duplicateRevision}
          concertId={concert.id}
          venues={data.venues}
          {...(duplicateValues ? { initialValues: duplicateValues } : {})}
        />
      </div>

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
                onDuplicate={() => duplicate(practice)}
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
  onDuplicate: () => void
}

function AdminPracticeItem({
  practice,
  concertId,
  venues,
  onDuplicate,
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

      <MediaSection practice={practice} />

      <div className="controls">
        <button type="button" className="secondary" onClick={onDuplicate}>
          複製して編集
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
          title={`${formatDate(practice.date)}の練習を削除しますか？`}
          description={<p>{deleteWarning(practice)}</p>}
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

function MediaSection({ practice }: { practice: PracticeAdminItem }) {
  const [adding, setAdding] = useState(false)
  const move = useServerFn(moveMedia)
  const remove = useServerFn(removeMedia)
  const action = useAdminAction()
  const last = practice.media.length - 1

  return (
    <>
      {practice.media.length > 0 && (
        <div>
          <p className="item-note">録音・録画</p>
          <ul className="media-list">
            {practice.media.map((link, index) => (
              <li key={link.id}>
                <ExternalLink href={link.url}>{link.title}</ExternalLink>
                <div className="controls">
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`「${link.title}」を上へ`}
                    disabled={index === 0 || action.running}
                    onClick={() =>
                      void action.run(() =>
                        move({ data: { id: link.id, direction: 'up' } }),
                      )
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`「${link.title}」を下へ`}
                    disabled={index === last || action.running}
                    onClick={() =>
                      void action.run(() =>
                        move({ data: { id: link.id, direction: 'down' } }),
                      )
                    }
                  >
                    ↓
                  </button>
                  <ConfirmButton
                    label="削除"
                    title={`「${link.title}」を削除しますか？`}
                    description={
                      <p>リンクだけを消します。録音そのものは残ります。</p>
                    }
                    disabled={action.running}
                    onConfirm={() =>
                      action.run(() => remove({ data: { id: link.id } }))
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormError message={action.failure} />

      {adding ? (
        <MediaForm practiceId={practice.id} onDone={() => setAdding(false)} />
      ) : (
        <div className="controls">
          <button
            type="button"
            className="secondary"
            onClick={() => setAdding(true)}
          >
            録音・録画リンクを追加
          </button>
        </div>
      )}
    </>
  )
}

type MediaFormProps = {
  practiceId: number
  onDone: () => void
}

function MediaForm({ practiceId, onDone }: MediaFormProps) {
  const id = useId()
  const add = useServerFn(addMedia)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  const form = useAdminForm({
    schema: mediaInput,
    action: (data) => add({ data: { ...data, practiceId } }),
    onSaved: onDone,
  })

  return (
    <AdminForm
      title="録音・録画リンクを追加"
      titleLevel={3}
      onSubmit={form.onSubmit(() => ({ title, url }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={onDone}
    >
      <Field
        id={`${id}-title`}
        label="表示名"
        hint="例: 1楽章 通し"
        error={form.errors.title}
      >
        <input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-url`}
        label="URL"
        hint="Google ドライブや YouTube など"
        error={form.errors.url}
      >
        <input
          id={`${id}-url`}
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}

type PracticeFormProps = {
  practice?: PracticeAdminItem
  concertId: number
  venues: ReadonlyArray<VenueOption>
  initialValues?: PracticeFormValues
  onDone?: () => void
}

function PracticeForm({
  practice,
  concertId,
  venues,
  initialValues,
  onDone,
}: PracticeFormProps) {
  const id = useId()
  const add = useServerFn(addPractice)
  const edit = useServerFn(editPractice)
  const [date, setDate] = useState(practice?.date ?? initialValues?.date ?? '')
  const [startTime, setStartTime] = useState(
    practice?.startTime ?? initialValues?.startTime ?? '',
  )
  const [endTime, setEndTime] = useState(
    practice?.endTime ?? initialValues?.endTime ?? '',
  )
  const [venueId, setVenueId] = useState(
    String(practice?.venueId ?? initialValues?.venueId ?? ''),
  )
  const [detail, setDetail] = useState(
    practice?.detail ?? initialValues?.detail ?? '',
  )

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

function deleteWarning(practice: PracticeAdminItem): string {
  if (practice.media.length === 0) {
    return 'この練習に録音・録画リンクは付いていません。元に戻せません。'
  }

  return `付いている録音・録画リンク ${practice.media.length} 件も一緒に消えます。元に戻せません。`
}
