import { Text } from '@mantine/core'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useId, useState } from 'react'
import { z } from 'zod'
import { requireAdmin } from '../auth/middleware'
import {
  createConcertResource,
  deleteConcertResource,
  moveConcertResource,
  updateConcertResource,
} from '../concert-resources/mutations'
import type { ConcertAdminItem } from '../concerts/queries'
import { getDb } from '../db/client'
import {
  CONCERT_RESOURCE_LIMIT_MESSAGE,
  MAX_CONCERT_RESOURCES,
  MAX_LENGTH,
} from '../lib/limits'
import { DIRECTIONS } from '../lib/ordering'
import { idValue, requiredText, requiredUrl } from '../lib/validation'
import { logServerFn } from '../observability/logged-server-fn'
import { AdminForm, Field, useAdminAction, useAdminForm } from './admin-form'
import { AdminManagedLinkRow, AdminRowActions } from './admin-row-actions'
import { ControlRow, MediaList, SecondaryButton } from './control-row'
import { ExternalLink } from './external-link'
import { AppTextInput } from './form-controls'

const resourceInput = z.object({
  title: requiredText(MAX_LENGTH.resourceTitle),
  url: requiredUrl,
})

type ResourceActionResult = { ok: true } | { ok: false; reason: 'limit' }

const addResource = createServerFn({ method: 'POST' })
  .middleware([logServerFn('addResource'), requireAdmin])
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
  .middleware([logServerFn('editResource'), requireAdmin])
  .validator(resourceInput.extend({ id: idValue }))
  .handler(
    async ({ data: { id, ...fields } }): Promise<ResourceActionResult> => {
      await updateConcertResource(getDb(), id, fields)
      return { ok: true }
    },
  )

const moveResource = createServerFn({ method: 'POST' })
  .middleware([logServerFn('moveResource'), requireAdmin])
  .validator(z.object({ id: idValue, direction: z.enum(DIRECTIONS) }))
  .handler(({ data }) => moveConcertResource(getDb(), data.id, data.direction))

const removeResource = createServerFn({ method: 'POST' })
  .middleware([logServerFn('removeResource'), requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deleteConcertResource(getDb(), data.id))

export function ResourceSection({ concert }: { concert: ConcertAdminItem }) {
  const [adding, setAdding] = useState(false)
  const atLimit = concert.resources.length >= MAX_CONCERT_RESOURCES

  return (
    <>
      {concert.resources.length > 0 && (
        <MediaList title="資料">
          {concert.resources.map((resource, index) => (
            <ResourceItem
              key={resource.id}
              resource={resource}
              first={index === 0}
              last={index === concert.resources.length - 1}
            />
          ))}
        </MediaList>
      )}

      {adding ? (
        <ResourceForm concertId={concert.id} onDone={() => setAdding(false)} />
      ) : (
        <ControlRow>
          <SecondaryButton disabled={atLimit} onClick={() => setAdding(true)}>
            資料リンクを追加
          </SecondaryButton>
        </ControlRow>
      )}
      {atLimit && (
        <Text size="sm" c="dimmed">
          資料は{MAX_CONCERT_RESOURCES}件まで登録できます
        </Text>
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
      <AdminManagedLinkRow
        link={<ExternalLink href={resource.url}>{resource.title}</ExternalLink>}
        actions={
          <AdminRowActions
            failure={action.failure}
            disabled={action.running}
            onEdit={() => setEditing(true)}
            editAriaLabel={`「${resource.title}」を編集`}
            onMoveUp={() =>
              void action.run(() =>
                move({ data: { id: resource.id, direction: 'up' } }),
              )
            }
            onMoveDown={() =>
              void action.run(() =>
                move({ data: { id: resource.id, direction: 'down' } }),
              )
            }
            canMoveUp={!first}
            canMoveDown={!last}
            moveUpLabel={`「${resource.title}」を上へ`}
            moveDownLabel={`「${resource.title}」を下へ`}
            deleteTitle={`「${resource.title}」を削除しますか？`}
            deleteAriaLabel={`「${resource.title}」を削除`}
            deleteDescription={
              <p>リンクだけを消します。リンク先の外部ファイルは残ります。</p>
            }
            onDelete={() =>
              action.run(() => remove({ data: { id: resource.id } }))
            }
          />
        }
      />
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
    getResultFailure: (result: ResourceActionResult) =>
      result.ok ? null : CONCERT_RESOURCE_LIMIT_MESSAGE,
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
        <AppTextInput
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field id={`${id}-url`} label="URL" error={form.errors.url}>
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
