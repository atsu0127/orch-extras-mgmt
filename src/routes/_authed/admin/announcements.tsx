import { Stack, Text } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useId, useState } from 'react'
import { z } from 'zod'
import { announcementInput } from '../../../announcements/input'
import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from '../../../announcements/mutations'
import { listAnnouncementsForConcert } from '../../../announcements/queries'
import { requireAdmin } from '../../../auth/middleware'
import {
  AdminForm,
  Field,
  useAdminAction,
  useAdminForm,
} from '../../../components/admin-form'
import { AdminRowActions } from '../../../components/admin-row-actions'
import { AdminList, AdminListItem } from '../../../components/control-row'
import { ExternalLink } from '../../../components/external-link'
import { AppTextarea, AppTextInput } from '../../../components/form-controls'
import {
  EmptyState,
  NoConcertState,
  PageSection,
} from '../../../components/states'
import { getDb } from '../../../db/client'
import type { Announcement } from '../../../db/schema'
import { formatDate, jstDateOf } from '../../../lib/date'
import {
  ANNOUNCEMENT_LIMIT_MESSAGE,
  MAX_ANNOUNCEMENTS,
} from '../../../lib/limits'
import { idValue } from '../../../lib/validation'
import { loggedServerFn } from '../../../observability/logged-server-fn'

type AnnouncementActionResult = { ok: true } | { ok: false; reason: 'limit' }

const getAnnouncements = loggedServerFn('getAnnouncements', { method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ concertId: idValue }))
  .handler(({ data }) => listAnnouncementsForConcert(getDb(), data.concertId))

const addAnnouncement = loggedServerFn('addAnnouncement', { method: 'POST' })
  .middleware([requireAdmin])
  .validator(announcementInput.extend({ concertId: idValue }))
  .handler(
    async ({
      data: { concertId, ...fields },
    }): Promise<AnnouncementActionResult> => {
      try {
        await createAnnouncement(getDb(), concertId, fields)
        return { ok: true }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === ANNOUNCEMENT_LIMIT_MESSAGE
        ) {
          return { ok: false, reason: 'limit' }
        }
        throw error
      }
    },
  )

const editAnnouncement = loggedServerFn('editAnnouncement', { method: 'POST' })
  .middleware([requireAdmin])
  .validator(announcementInput.extend({ id: idValue }))
  .handler(
    async ({ data: { id, ...fields } }): Promise<AnnouncementActionResult> => {
      await updateAnnouncement(getDb(), id, fields)
      return { ok: true }
    },
  )

const removeAnnouncement = loggedServerFn('removeAnnouncement', {
  method: 'POST',
})
  .middleware([requireAdmin])
  .validator(z.object({ id: idValue }))
  .handler(({ data }) => deleteAnnouncement(getDb(), data.id))

/** 演奏会を切り替えたとき追加フォームの入力を残さない（AGENTS.md） */
export function announcementCreateFormKey(concertId: number): string {
  return String(concertId)
}

export const Route = createFileRoute('/_authed/admin/announcements')({
  loaderDeps: ({ search }) => ({ concert: search.concert }),
  loader: ({ deps }) =>
    deps.concert === undefined
      ? null
      : getAnnouncements({ data: { concertId: deps.concert } }),
  component: AdminAnnouncementsPage,
})

function AdminAnnouncementsPage() {
  const { session, concert } = Route.useRouteContext()
  const items = Route.useLoaderData()
  if (!items || !concert) return <NoConcertState role={session.role} />

  const atLimit = items.length >= MAX_ANNOUNCEMENTS

  return (
    <PageSection title="お知らせ" titleOrder={1}>
      <Text c="dimmed">
        「{concert.name}」の短い更新です。新しいものが閲覧ホームの先頭に出ます。
      </Text>

      {atLimit ? (
        <Text size="sm" c="dimmed">
          お知らせは{MAX_ANNOUNCEMENTS}
          件まで登録できます。古いものを削除してから追加してください。
        </Text>
      ) : (
        <AnnouncementForm
          key={announcementCreateFormKey(concert.id)}
          concertId={concert.id}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          title="お知らせはまだありません"
          description="上のフォームから追加してください。"
        />
      ) : (
        <AdminList>
          {items.map((item) => (
            <AnnouncementItem key={item.id} announcement={item} />
          ))}
        </AdminList>
      )}
    </PageSection>
  )
}

type AnnouncementItemProps = {
  announcement: Announcement
}

function AnnouncementItem({ announcement }: AnnouncementItemProps) {
  const [editing, setEditing] = useState(false)
  const remove = useServerFn(removeAnnouncement)
  const action = useAdminAction()

  if (editing) {
    return (
      <li>
        <AnnouncementForm
          announcement={announcement}
          concertId={announcement.concertId}
          onDone={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <AdminListItem>
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          {formatDate(jstDateOf(new Date(announcement.createdAt)))}
        </Text>
        <Text fw={600}>{announcement.title}</Text>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {announcement.body}
        </Text>
        {announcement.url && (
          <ExternalLink href={announcement.url}>関連リンクを開く</ExternalLink>
        )}
        <AdminRowActions
          failure={action.failure}
          disabled={action.running}
          onEdit={() => setEditing(true)}
          editAriaLabel={`「${announcement.title}」を編集`}
          moveUpLabel=""
          moveDownLabel=""
          deleteTitle={`「${announcement.title}」を削除しますか？`}
          deleteAriaLabel={`「${announcement.title}」を削除`}
          deleteDescription={<p>元に戻せません。</p>}
          onDelete={() =>
            action.run(() => remove({ data: { id: announcement.id } }))
          }
        />
      </Stack>
    </AdminListItem>
  )
}

type AnnouncementFormProps = {
  announcement?: Announcement
  concertId: number
  onDone?: () => void
}

function AnnouncementForm({
  announcement,
  concertId,
  onDone,
}: AnnouncementFormProps) {
  const id = useId()
  const add = useServerFn(addAnnouncement)
  const edit = useServerFn(editAnnouncement)
  const [title, setTitle] = useState(announcement?.title ?? '')
  const [body, setBody] = useState(announcement?.body ?? '')
  const [url, setUrl] = useState(announcement?.url ?? '')

  const form = useAdminForm({
    schema: announcementInput,
    action: (data) =>
      announcement
        ? edit({ data: { ...data, id: announcement.id } })
        : add({ data: { ...data, concertId } }),
    getResultFailure: (result: AnnouncementActionResult) =>
      result.ok ? null : ANNOUNCEMENT_LIMIT_MESSAGE,
    onSaved: () => {
      if (announcement) {
        onDone?.()
        return
      }
      setTitle('')
      setBody('')
      setUrl('')
    },
  })

  return (
    <AdminForm
      title={announcement ? 'お知らせを編集' : 'お知らせを追加'}
      onSubmit={form.onSubmit(() => ({ title, body, url }))}
      failure={form.failure}
      submitting={form.submitting}
      onCancel={announcement ? onDone : undefined}
    >
      <Field id={`${id}-title`} label="タイトル" error={form.errors.title}>
        <AppTextInput
          id={`${id}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field id={`${id}-body`} label="本文" error={form.errors.body}>
        <AppTextarea
          id={`${id}-body`}
          value={body}
          minRows={4}
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-url`}
        label="関連URL（任意）"
        hint="資料やボウイングなど、関連するページがあれば"
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
