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
import { EmptyState } from '../../../components/states'
import {
  createConcertResource,
  deleteConcertResource,
  moveConcertResource,
  updateConcertResource,
} from '../../../concert-resources/mutations'
import { concertInput } from '../../../concerts/input'
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
import {
  CONCERT_RESOURCE_LIMIT_MESSAGE,
  MAX_CONCERT_RESOURCES,
  MAX_LENGTH,
} from '../../../lib/limits'
import { DIRECTIONS } from '../../../lib/ordering'
import {
  idValue,
  requiredText,
  requiredUrl,
  toOptionalId,
} from '../../../lib/validation'
import { listVenueOptions, type VenueOption } from '../../../venues/queries'

const resourceInput = z.object({
  title: requiredText(MAX_LENGTH.resourceTitle),
  url: requiredUrl,
})

type ResourceActionResult = { ok: true } | { ok: false; reason: 'limit' }

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

const addResource = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(resourceInput.extend({ concertId: idValue }))
  .handler(
    async ({
      data: { concertId, ...fields },
    }): Promise<ResourceActionResult> => {
      try {
        await createConcertResource(getDb(), concertId, fields)
        return { ok: true }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === CONCERT_RESOURCE_LIMIT_MESSAGE
        ) {
          return { ok: false, reason: 'limit' }
        }
        throw error
      }
    },
  )

const editResource = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(resourceInput.extend({ id: idValue }))
  .handler(
    async ({ data: { id, ...fields } }): Promise<ResourceActionResult> => {
      await updateConcertResource(getDb(), id, fields)
      return { ok: true }
    },
  )

const moveResource = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue, direction: z.enum(DIRECTIONS) }))
  .handler(({ data }) => moveConcertResource(getDb(), data.id, data.direction))

const removeResource = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deleteConcertResource(getDb(), data.id))

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
        {` / 練習 ${concert.practiceCount} 件 / 曲 ${concert.pieceCount} 件 / 資料 ${concert.resourceCount} 件`}
      </p>

      <ResourceSection concert={concert} />

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

function ResourceSection({ concert }: { concert: ConcertAdminItem }) {
  const [adding, setAdding] = useState(false)
  const atLimit = concert.resources.length >= MAX_CONCERT_RESOURCES

  return (
    <>
      {concert.resources.length > 0 && (
        <div>
          <p className="item-note">資料</p>
          <ul className="media-list">
            {concert.resources.map((resource, index) => (
              <ResourceItem
                key={resource.id}
                resource={resource}
                first={index === 0}
                last={index === concert.resources.length - 1}
              />
            ))}
          </ul>
        </div>
      )}

      {adding ? (
        <ResourceForm concertId={concert.id} onDone={() => setAdding(false)} />
      ) : (
        <div className="controls">
          <button
            type="button"
            className="secondary"
            disabled={atLimit}
            onClick={() => setAdding(true)}
          >
            資料リンクを追加
          </button>
        </div>
      )}
      {atLimit && (
        <p className="item-note">
          資料は{MAX_CONCERT_RESOURCES}件まで登録できます
        </p>
      )}
    </>
  )
}

type ConcertResourceItem = ConcertAdminItem['resources'][number]

type ResourceItemProps = {
  resource: ConcertResourceItem
  first: boolean
  last: boolean
}

function ResourceItem({ resource, first, last }: ResourceItemProps) {
  const [editing, setEditing] = useState(false)
  const move = useServerFn(moveResource)
  const remove = useServerFn(removeResource)
  const action = useAdminAction()

  if (editing) {
    return (
      <li>
        <ResourceForm
          resource={resource}
          concertId={resource.concertId}
          onDone={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li>
      <ExternalLink href={resource.url}>{resource.title}</ExternalLink>
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
          aria-label={`「${resource.title}」を上へ`}
          disabled={first || action.running}
          onClick={() =>
            void action.run(() =>
              move({ data: { id: resource.id, direction: 'up' } }),
            )
          }
        >
          ↑
        </button>
        <button
          type="button"
          className="secondary"
          aria-label={`「${resource.title}」を下へ`}
          disabled={last || action.running}
          onClick={() =>
            void action.run(() =>
              move({ data: { id: resource.id, direction: 'down' } }),
            )
          }
        >
          ↓
        </button>
        <ConfirmButton
          label="削除"
          title={`「${resource.title}」を削除しますか？`}
          description={
            <p>リンクだけを消します。リンク先の外部ファイルは残ります。</p>
          }
          disabled={action.running}
          onConfirm={() =>
            action.run(() => remove({ data: { id: resource.id } }))
          }
        />
      </div>
      <FormError message={action.failure} />
    </li>
  )
}

type ResourceFormProps = {
  resource?: ConcertResourceItem
  concertId: number
  onDone: () => void
}

function ResourceForm({ resource, concertId, onDone }: ResourceFormProps) {
  const id = useId()
  const add = useServerFn(addResource)
  const edit = useServerFn(editResource)
  const [title, setTitle] = useState(resource?.title ?? '')
  const [url, setUrl] = useState(resource?.url ?? '')

  const form = useAdminForm({
    schema: resourceInput,
    action: (data) =>
      resource
        ? edit({ data: { ...data, id: resource.id } })
        : add({ data: { ...data, concertId } }),
    ...(resource
      ? {}
      : {
          getResultFailure: (result: ResourceActionResult) =>
            result.ok ? null : CONCERT_RESOURCE_LIMIT_MESSAGE,
        }),
    onSaved: onDone,
  })

  return (
    <AdminForm
      title={resource ? '資料リンクを編集' : '資料リンクを追加'}
      titleLevel={3}
      onSubmit={form.onSubmit(() => ({ title, url }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={onDone}
    >
      <Field
        id={`${id}-title`}
        label="タイトル"
        hint="例: 演奏会のしおり"
        error={form.errors.title}
      >
        <input
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field id={`${id}-url`} label="URL" error={form.errors.url}>
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
  const [note, setNote] = useState(concert?.note ?? '')

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
      setNote('')
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
        note,
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

      <Field
        id={`${id}-note`}
        label="備考（任意）"
        hint="集合時間、服装、持ち物など"
        error={form.errors.note}
      >
        <textarea
          id={`${id}-note`}
          rows={6}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}

function deleteWarning(concert: ConcertAdminItem): string {
  if (
    concert.practiceCount + concert.pieceCount + concert.resourceCount ===
    0
  ) {
    return 'この演奏会に練習と曲と資料は登録されていません。元に戻せません。'
  }

  return `練習 ${concert.practiceCount} 件（付いている録音リンクを含む）、曲 ${concert.pieceCount} 件、資料リンク ${concert.resourceCount} 件も一緒に消えます。元に戻せません。残しておくだけならアーカイブを使ってください。`
}
