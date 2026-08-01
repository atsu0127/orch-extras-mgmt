import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
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
import { forgetConcerts } from '../../../concerts/concert-cache'
import { getDb } from '../../../db/client'
import { formatDate, formatTimeRange } from '../../../lib/date'
import {
  BULK_PRACTICE_LIMIT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE,
  MAX_BULK_PRACTICES,
  MAX_LENGTH,
} from '../../../lib/limits'
import { DIRECTIONS } from '../../../lib/ordering'
import {
  idValue,
  optionalText,
  requiredText,
  requiredUrl,
  toOptionalId,
} from '../../../lib/validation'
import { createPracticesBulk } from '../../../practices/bulk'
import {
  type BulkPracticeRowDraft,
  bulkPracticeCreateFormKey,
  collectBulkPracticesInput,
  createEmptyBulkPracticeRow,
  duplicateBulkPracticeRow,
  firstBulkValidationMessage,
} from '../../../practices/bulk-form-state'
import { bulkPracticesInput } from '../../../practices/bulk-input'
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
import { createVenue } from '../../../venues/mutations'
import { listVenueOptions, type VenueOption } from '../../../venues/queries'

const BULK_BUSINESS_MESSAGES = new Set([
  BULK_PRACTICE_LIMIT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE,
  BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
])

type BulkAddResult =
  | { ok: true; practiceCount: number }
  | { ok: false; message: string }

const venueInput = z.object({
  name: requiredText(MAX_LENGTH.venueName),
  address: requiredText(MAX_LENGTH.venueAddress),
  note: optionalText(MAX_LENGTH.venueNote),
})

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

const addVenueFromBulk = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(venueInput)
  .handler(({ data }) => createVenue(getDb(), data))

const addPracticesBulk = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(bulkPracticesInput)
  .handler(async ({ data }): Promise<BulkAddResult> => {
    try {
      const result = await createPracticesBulk(
        getDb(),
        data.concertId,
        data.rows,
      )
      return { ok: true, ...result }
    } catch (error) {
      if (error instanceof Error && BULK_BUSINESS_MESSAGES.has(error.message)) {
        return { ok: false, message: error.message }
      }
      throw error
    }
  })

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

type BulkPracticeFormProps = {
  concertId: number
  venues: ReadonlyArray<VenueOption>
}

function BulkPracticeForm({ concertId, venues }: BulkPracticeFormProps) {
  const id = useId()
  const router = useRouter()
  const addBulk = useServerFn(addPracticesBulk)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Array<BulkPracticeRowDraft>>([
    createEmptyBulkPracticeRow(),
  ])
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [venueModalRowKey, setVenueModalRowKey] = useState<string | null>(null)

  const updateRow = (
    index: number,
    patch: Partial<BulkPracticeRowDraft>,
  ): void => {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    )
  }

  const onVenueCreated = (rowKey: string, venueId: number) => {
    setRows((current) =>
      current.map((row) =>
        row.key === rowKey ? { ...row, venueId: String(venueId) } : row,
      ),
    )
    setVenueModalRowKey(null)
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void (async () => {
      setFailure(null)
      const input = collectBulkPracticesInput(concertId, rows)
      const parsed = bulkPracticesInput.safeParse(input)
      if (!parsed.success) {
        setFailure(firstBulkValidationMessage(parsed.error.issues))
        return
      }

      setSubmitting(true)
      try {
        const result = await addBulk({ data: input })
        if (!result.ok) {
          setFailure(result.message)
          return
        }
        forgetConcerts()
        await router.invalidate()
        setRows([createEmptyBulkPracticeRow()])
      } catch {
        setFailure(
          '保存できませんでした。通信を確かめて、時間をおいてやり直してください。',
        )
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <Stack gap="md">
      <ControlRow>
        <SecondaryButton onClick={() => setOpen((current) => !current)}>
          {open ? '一括追加を閉じる' : '一括追加'}
        </SecondaryButton>
      </ControlRow>

      {open ? (
        <AdminForm
          title="練習を一括追加"
          onSubmit={onSubmit}
          failure={failure}
          submitting={submitting}
        >
          <Text size="sm" c="dimmed">
            最大{MAX_BULK_PRACTICES}
            件まで一度に登録できます。会場の新規追加は各行のボタンからすぐに保存できます。
          </Text>

          <Stack gap="lg">
            {rows.map((row, index) => (
              <BulkPracticeRowFields
                key={row.key}
                idPrefix={`${id}-${row.key}`}
                index={index}
                row={row}
                venues={venues}
                canRemove={rows.length > 1}
                canDuplicate={rows.length < MAX_BULK_PRACTICES && !submitting}
                onChange={(patch) => updateRow(index, patch)}
                onRemove={() =>
                  setRows((current) =>
                    current.filter((item) => item.key !== row.key),
                  )
                }
                onDuplicate={() =>
                  setRows((current) => [
                    ...current,
                    duplicateBulkPracticeRow(row),
                  ])
                }
                onAddVenue={() => setVenueModalRowKey(row.key)}
              />
            ))}
          </Stack>

          <ControlRow>
            <SecondaryButton
              disabled={rows.length >= MAX_BULK_PRACTICES || submitting}
              onClick={() =>
                setRows((current) => [...current, createEmptyBulkPracticeRow()])
              }
            >
              行を追加
            </SecondaryButton>
          </ControlRow>
        </AdminForm>
      ) : null}

      {venueModalRowKey !== null ? (
        <BulkVenueCreateDialog
          onClose={() => setVenueModalRowKey(null)}
          onCreated={(venueId) => onVenueCreated(venueModalRowKey, venueId)}
        />
      ) : null}
    </Stack>
  )
}

type BulkVenueCreateDialogProps = {
  onClose: () => void
  onCreated: (venueId: number) => void
}

function BulkVenueCreateDialog({
  onClose,
  onCreated,
}: BulkVenueCreateDialogProps) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const addVenue = useServerFn(addVenueFromBulk)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  function requestClose() {
    if (!submitting) dialog.current?.close()
  }

  const titleId = `${id}-venue-dialog-title`

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void (async () => {
      setFailure(null)
      const parsed = venueInput.safeParse({ name, address, note })
      if (!parsed.success) {
        setFailure(
          parsed.error.issues[0]?.message ?? '入力内容を確認してください',
        )
        return
      }

      setSubmitting(true)
      try {
        const venueId = await addVenue({
          data: { name, address, note },
        })
        forgetConcerts()
        await router.invalidate()
        onCreated(venueId)
      } catch {
        setFailure(
          '保存できませんでした。通信を確かめて、時間をおいてやり直してください。',
        )
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <Title id={titleId} order={2} size="h3">
            会場を新規追加
          </Title>
          <Field id={`${id}-name`} label="会場名">
            <AppTextInput
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field id={`${id}-address`} label="住所">
            <AppTextInput
              id={`${id}-address`}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          <Field id={`${id}-note`} label="会場メモ（任意）">
            <AppTextInput
              id={`${id}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          {failure ? <FormError message={failure} /> : null}
          <Group grow>
            <SecondaryButton disabled={submitting} onClick={requestClose}>
              キャンセル
            </SecondaryButton>
            <Button type="submit" disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </Button>
          </Group>
        </Stack>
      </form>
    </dialog>
  )
}

type BulkPracticeRowFieldsProps = {
  idPrefix: string
  index: number
  row: BulkPracticeRowDraft
  venues: ReadonlyArray<VenueOption>
  canRemove: boolean
  canDuplicate: boolean
  onChange: (patch: Partial<BulkPracticeRowDraft>) => void
  onRemove: () => void
  onDuplicate: () => void
  onAddVenue: () => void
}

function BulkPracticeRowFields({
  idPrefix,
  index,
  row,
  venues,
  canRemove,
  canDuplicate,
  onChange,
  onRemove,
  onDuplicate,
  onAddVenue,
}: BulkPracticeRowFieldsProps) {
  return (
    <Stack
      gap="md"
      role="group"
      aria-label={`${index + 1}行目`}
      style={{
        border: '1px solid var(--app-border)',
        borderRadius: 'var(--mantine-radius-md)',
        padding: 'var(--mantine-spacing-md)',
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap">
        <Text fw={600}>{index + 1}行目</Text>
        <Group gap="xs">
          <SecondaryButton disabled={!canDuplicate} onClick={onDuplicate}>
            この行を複製
          </SecondaryButton>
          {canRemove ? (
            <SecondaryButton onClick={onRemove}>この行を削除</SecondaryButton>
          ) : null}
        </Group>
      </Group>

      <Field id={`${idPrefix}-date`} label="日付">
        <AppTextInput
          id={`${idPrefix}-date`}
          type="date"
          value={row.date}
          onChange={(event) => onChange({ date: event.target.value })}
        />
      </Field>

      <Group grow align="flex-start">
        <Field id={`${idPrefix}-start`} label="開始（任意）">
          <AppTextInput
            id={`${idPrefix}-start`}
            type="time"
            value={row.startTime}
            onChange={(event) => onChange({ startTime: event.target.value })}
          />
        </Field>
        <Field id={`${idPrefix}-end`} label="終了（任意）">
          <AppTextInput
            id={`${idPrefix}-end`}
            type="time"
            value={row.endTime}
            onChange={(event) => onChange({ endTime: event.target.value })}
          />
        </Field>
      </Group>

      <Field
        id={`${idPrefix}-venue`}
        label="会場（任意）"
        hint={venues.length === 0 ? '会場を登録すると選べます' : undefined}
      >
        <AppSelect
          id={`${idPrefix}-venue`}
          value={row.venueId}
          onChange={(event) => onChange({ venueId: event.target.value })}
        >
          <option value="">未設定</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </AppSelect>
      </Field>

      <ControlRow>
        <SecondaryButton onClick={onAddVenue}>会場を新規追加</SecondaryButton>
      </ControlRow>

      <Field id={`${idPrefix}-detail`} label="詳細（任意）">
        <AppTextarea
          id={`${idPrefix}-detail`}
          rows={2}
          value={row.detail}
          onChange={(event) => onChange({ detail: event.target.value })}
        />
      </Field>
    </Stack>
  )
}
