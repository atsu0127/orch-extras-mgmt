import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { useRouter } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'
import { requireAdmin } from '../auth/middleware'
import { forgetConcerts } from '../concerts/concert-cache'
import { getDb } from '../db/client'
import {
  BULK_PRACTICE_LIMIT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE,
  MAX_BULK_PRACTICES,
  MAX_LENGTH,
} from '../lib/limits'
import { optionalText, requiredText } from '../lib/validation'
import { createPracticesBulk } from '../practices/bulk'
import {
  type BulkPracticeRowDraft,
  collectBulkPracticesInput,
  createEmptyBulkPracticeRow,
  duplicateBulkPracticeRow,
  firstBulkValidationMessage,
} from '../practices/bulk-form-state'
import { bulkPracticesInput } from '../practices/bulk-input'
import { createVenue } from '../venues/mutations'
import type { VenueOption } from '../venues/queries'
import { AdminForm, Field, FormError } from './admin-form'
import { ControlRow, SecondaryButton } from './control-row'
import { AppSelect, AppTextarea, AppTextInput } from './form-controls'

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

type BulkPracticeFormProps = {
  concertId: number
  venues: ReadonlyArray<VenueOption>
}

export function BulkPracticeForm({ concertId, venues }: BulkPracticeFormProps) {
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
