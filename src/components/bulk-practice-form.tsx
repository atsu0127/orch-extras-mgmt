import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'
import { requireAdmin } from '../auth/middleware'
import { getDb } from '../db/client'
import {
  BULK_PRACTICE_LIMIT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE,
  BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE,
  MAX_BULK_PRACTICES,
  MAX_LENGTH,
} from '../lib/limits'
import { optionalText, requiredText } from '../lib/validation'
import { loggedServerFn } from '../observability/logged-server-fn'
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
import { AdminForm, Field, FormError, useAdminForm } from './admin-form'
import { ControlRow, SecondaryButton } from './control-row'
import { AppTextarea, AppTextInput } from './form-controls'
import { VenueSelectField } from './venue-select-field'

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

const addVenueFromBulk = loggedServerFn('addVenueFromBulk', { method: 'POST' })
  .middleware([requireAdmin])
  .validator(venueInput)
  .handler(({ data }) => createVenue(getDb(), data))

const addPracticesBulk = loggedServerFn('addPracticesBulk', { method: 'POST' })
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
  const addBulk = useServerFn(addPracticesBulk)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Array<BulkPracticeRowDraft>>([
    createEmptyBulkPracticeRow(),
  ])
  const [venueModalRowKey, setVenueModalRowKey] = useState<string | null>(null)

  const form = useAdminForm({
    schema: bulkPracticesInput,
    action: (data) => addBulk({ data }),
    getResultFailure: (result: BulkAddResult) =>
      result.ok ? null : result.message,
    formatValidationFailure: (error) =>
      firstBulkValidationMessage(error.issues),
    onSaved: () => setRows([createEmptyBulkPracticeRow()]),
  })

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
          onSubmit={form.onSubmit(() =>
            collectBulkPracticesInput(concertId, rows),
          )}
          failure={form.failure}
          submitting={form.submitting}
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
                canDuplicate={
                  rows.length < MAX_BULK_PRACTICES && !form.submitting
                }
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
              disabled={rows.length >= MAX_BULK_PRACTICES || form.submitting}
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
  const addVenue = useServerFn(addVenueFromBulk)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')

  const form = useAdminForm({
    schema: venueInput,
    action: (data) => addVenue({ data }),
    onSaved: (venueId) => onCreated(venueId),
  })

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  function requestClose() {
    if (!form.submitting) dialog.current?.close()
  }

  const titleId = `${id}-venue-dialog-title`

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
      <form
        noValidate
        onSubmit={form.onSubmit(() => ({ name, address, note }))}
      >
        <Stack gap="md">
          <Title id={titleId} order={2} size="h3">
            会場を新規追加
          </Title>
          <Field id={`${id}-name`} label="会場名" error={form.errors.name}>
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
            label="会場メモ（任意）"
            error={form.errors.note}
          >
            <AppTextInput
              id={`${id}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <FormError message={form.failure} />
          <Group grow>
            <SecondaryButton disabled={form.submitting} onClick={requestClose}>
              キャンセル
            </SecondaryButton>
            <Button type="submit" disabled={form.submitting}>
              {form.submitting ? '保存中…' : '保存'}
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

      <VenueSelectField
        id={`${idPrefix}-venue`}
        label="会場（任意）"
        value={row.venueId}
        venues={venues}
        onChange={(venueId) => onChange({ venueId })}
      />

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
