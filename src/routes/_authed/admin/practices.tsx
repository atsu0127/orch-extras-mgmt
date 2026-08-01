import { Group, Stack, Text } from '@mantine/core'
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
import {
  AdminManagedLinkRow,
  AdminRowActions,
} from '../../../components/admin-row-actions'
import { BulkPracticeForm } from '../../../components/bulk-practice-form'
import { ConfirmButton } from '../../../components/confirm-button'
import {
  AdminList,
  AdminListItem,
  ControlRow,
  MediaList,
  SecondaryButton,
} from '../../../components/control-row'
import { ExternalLink } from '../../../components/external-link'
import {
  AppSelect,
  AppTextarea,
  AppTextInput,
} from '../../../components/form-controls'
import {
  EmptyState,
  NoConcertState,
  PageSection,
} from '../../../components/states'
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
import { bulkPracticeCreateFormKey } from '../../../practices/bulk-form-state'
import {
  createDuplicatePracticeState,
  type DuplicatePracticeState,
  duplicatePracticeValuesForConcert,
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
  const [duplicateState, setDuplicateState] = useState<DuplicatePracticeState>()
  const newFormRef = useRef<HTMLDivElement>(null)
  const duplicateValues = concert
    ? duplicatePracticeValuesForConcert(duplicateState, concert.id)
    : undefined

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
    setDuplicateState((current) =>
      createDuplicatePracticeState(current, concert.id, practice),
    )
  }

  return (
    <PageSection title="練習" titleOrder={1}>
      <Text c="dimmed">
        「{concert.name}」の練習です。別の演奏会は上のセレクタで切り替えます。
      </Text>

      <div ref={newFormRef}>
        <PracticeForm
          key={`${concert.id}:${duplicateState?.revision ?? 0}`}
          concertId={concert.id}
          venues={data.venues}
          {...(duplicateValues ? { initialValues: duplicateValues } : {})}
        />
      </div>

      <BulkPracticeForm
        key={bulkPracticeCreateFormKey(concert.id)}
        concertId={concert.id}
        venues={data.venues}
      />

      {data.practices.length === 0 ? (
        <EmptyState
          title="練習はまだ登録されていません"
          description="上のフォームから登録してください。"
        />
      ) : (
        <AdminList>
          {data.practices.map((practice) => (
            <AdminPracticeItem
              key={practice.id}
              practice={practice}
              concertId={concert.id}
              venues={data.venues}
              onDuplicate={() => duplicate(practice)}
            />
          ))}
        </AdminList>
      )}
    </PageSection>
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
      <li>
        <PracticeForm
          practice={practice}
          concertId={concertId}
          venues={venues}
          onDone={() => setEditing(false)}
        />
      </li>
    )
  }

  const venue = venues.find(({ id }) => id === practice.venueId)
  const time = formatTimeRange(practice.startTime, practice.endTime)

  return (
    <AdminListItem>
      <Stack gap={4}>
        <Text fw={600}>
          {formatDate(practice.date)}
          {time && ` ${time}`}
        </Text>
        <Text size="sm" c="dimmed">
          {venue ? venue.name : '会場は未設定'}
        </Text>
        {practice.detail && (
          <Text size="sm" c="dimmed">
            {practice.detail}
          </Text>
        )}

        <MediaSection practice={practice} />

        <ControlRow failure={action.failure}>
          <SecondaryButton onClick={onDuplicate}>複製して編集</SecondaryButton>
          <SecondaryButton
            aria-label={`${formatDate(practice.date)}の練習を編集`}
            onClick={() => setEditing(true)}
          >
            編集
          </SecondaryButton>
          <ConfirmButton
            label="削除"
            labelAriaLabel={`${formatDate(practice.date)}の練習を削除`}
            title={`${formatDate(practice.date)}の練習を削除しますか？`}
            description={<p>{deleteWarning(practice)}</p>}
            disabled={action.running}
            onConfirm={() =>
              action.run(() => remove({ data: { id: practice.id } }))
            }
          />
        </ControlRow>
      </Stack>
    </AdminListItem>
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
        <MediaList title="録音・録画">
          {practice.media.map((link, index) => (
            <li key={link.id}>
              <AdminManagedLinkRow
                link={<ExternalLink href={link.url}>{link.title}</ExternalLink>}
                actions={
                  <AdminRowActions
                    disabled={action.running}
                    onMoveUp={() =>
                      void action.run(() =>
                        move({ data: { id: link.id, direction: 'up' } }),
                      )
                    }
                    onMoveDown={() =>
                      void action.run(() =>
                        move({ data: { id: link.id, direction: 'down' } }),
                      )
                    }
                    canMoveUp={index > 0}
                    canMoveDown={index < last}
                    moveUpLabel={`「${link.title}」を上へ`}
                    moveDownLabel={`「${link.title}」を下へ`}
                    deleteTitle={`「${link.title}」を削除しますか？`}
                    deleteAriaLabel={`「${link.title}」を削除`}
                    deleteDescription={
                      <p>リンクだけを消します。録音そのものは残ります。</p>
                    }
                    onDelete={() =>
                      action.run(() => remove({ data: { id: link.id } }))
                    }
                  />
                }
              />
            </li>
          ))}
        </MediaList>
      )}
      <FormError message={action.failure} />

      {adding ? (
        <MediaForm practiceId={practice.id} onDone={() => setAdding(false)} />
      ) : (
        <ControlRow>
          <SecondaryButton onClick={() => setAdding(true)}>
            録音・録画リンクを追加
          </SecondaryButton>
        </ControlRow>
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
        <AppTextInput
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
        <AppTextInput
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
        <AppTextInput
          id={`${id}-date`}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>

      <Group grow align="flex-start">
        <Field
          id={`${id}-start`}
          label="開始（任意）"
          error={form.errors.startTime}
        >
          <AppTextInput
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
          <AppTextInput
            id={`${id}-end`}
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </Field>
      </Group>

      <Field
        id={`${id}-venue`}
        label="会場（任意）"
        hint={venues.length === 0 ? '会場を登録すると選べます' : undefined}
        error={form.errors.venueId}
      >
        <AppSelect
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
        </AppSelect>
      </Field>

      <Field
        id={`${id}-detail`}
        label="詳細（任意）"
        hint="分奏の編成、持ち物、集合場所など"
        error={form.errors.detail}
      >
        <AppTextarea
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
