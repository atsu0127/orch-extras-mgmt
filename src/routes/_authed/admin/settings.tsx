import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { type FormEvent, useId, useState } from 'react'
import { z } from 'zod'
import {
  type CredentialSummary,
  changePassword,
  listCredentials,
  verifyRolePassword,
} from '../../../auth/credentials'
import { MIN_PASSWORD_LENGTH, passwordChangeInput } from '../../../auth/input'
import { requireAdmin } from '../../../auth/middleware'
import { forgetCurrentSession } from '../../../auth/session-cache'
import { AdminForm, Field } from '../../../components/admin-form'
import { forgetConcerts } from '../../../concerts/concert-cache'
import { getDb } from '../../../db/client'
import { formatFullDate, jstDateOf } from '../../../lib/date'
import { ROLE_LABELS, ROLES, type Role } from '../../../lib/roles'
import { type FieldErrors, fieldErrors } from '../../../lib/validation'

const getCredentials = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(() => listCredentials(getDb()))

/**
 * 変更できるのは管理者だけなので、確かめるのも常に管理者のパスワード。
 * 端末を離席中に触られた場合に、そこで止めるための一手間である。
 */
const submitPasswordChange = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(passwordChangeInput.extend({ role: z.enum(ROLES) }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const db = getDb()
    if (!(await verifyRolePassword(db, 'admin', data.currentPassword))) {
      return { ok: false }
    }

    await changePassword(db, data.role, data.newPassword)
    return { ok: true }
  })

export const Route = createFileRoute('/_authed/admin/settings')({
  loader: () => getCredentials(),
  component: SettingsPage,
})

function SettingsPage() {
  const credentials = Route.useLoaderData()

  return (
    <section className="section">
      <h1>設定</h1>
      <p>
        パスワードはロールごとに1本です。変更すると、そのロールで開いている全員が
        ログアウトされ、新しいパスワードが必要になります。
      </p>

      {ROLES.map((role) => (
        <PasswordForm
          key={role}
          role={role}
          credential={credentials.find((row) => row.role === role)}
        />
      ))}
    </section>
  )
}

type PasswordFormProps = {
  role: Role
  credential: CredentialSummary | undefined
}

function PasswordForm({ role, credential }: PasswordFormProps) {
  const id = useId()
  const router = useRouter()
  const submit = useServerFn(submitPasswordChange)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 管理者のパスワードを変えると、いま使っているセッションも一緒に落ちる
  const signedOut = changed && role === 'admin'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFailure(null)

    const input = {
      currentPassword: current,
      newPassword: next,
      confirmPassword: confirm,
    }
    const parsed = passwordChangeInput.safeParse(input)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      const result = await submit({ data: { ...input, role } })
      if (!result.ok) {
        setErrors({ currentPassword: '管理者のパスワードが違います' })
        return
      }

      setCurrent('')
      setNext('')
      setConfirm('')
      setChanged(true)

      if (role === 'admin') {
        // 落ちたセッションを掴んだままにしないよう、手元の控えも捨てる
        forgetCurrentSession()
        forgetConcerts()
        return
      }
      await router.invalidate()
    } catch {
      setFailure(
        '変更できませんでした。通信を確かめて、時間をおいてやり直してください。',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (signedOut) {
    return (
      <div className="admin-form">
        <h2>{ROLE_LABELS[role]}のパスワード</h2>
        <p>
          変更しました。いまのログインは無効になったので、新しいパスワードで
          ログインしてください。
        </p>
        <p>
          <Link to="/login">ログイン画面へ</Link>
        </p>
      </div>
    )
  }

  return (
    <AdminForm
      title={`${ROLE_LABELS[role]}のパスワード`}
      onSubmit={handleSubmit}
      failure={failure}
      submitting={submitting}
    >
      <p className="field-hint">
        {credential
          ? `最終更新 ${formatFullDate(jstDateOf(new Date(credential.updatedAt)))}`
          : 'まだ設定されていません'}
      </p>
      {changed && <p className="notice">変更しました。</p>}

      <Field
        id={`${id}-current`}
        label="管理者の現在のパスワード"
        hint="変更する本人であることの確認に使います"
        error={errors.currentPassword}
      >
        <input
          id={`${id}-current`}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-new`}
        label={`${ROLE_LABELS[role]}の新しいパスワード`}
        hint={`${MIN_PASSWORD_LENGTH}文字以上`}
        error={errors.newPassword}
      >
        <input
          id={`${id}-new`}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
      </Field>

      <Field
        id={`${id}-confirm`}
        label="新しいパスワード（確認）"
        error={errors.confirmPassword}
      >
        <input
          id={`${id}-confirm`}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Field>
    </AdminForm>
  )
}
