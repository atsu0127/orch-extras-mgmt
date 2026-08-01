import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useRouter } from '@tanstack/react-router'
import { type FormEvent, type ReactNode, useState } from 'react'
import type { z } from 'zod'
import { forgetConcerts } from '../concerts/concert-cache'
import { type FieldErrors, fieldErrors } from '../lib/validation'

const FAILURE_MESSAGE =
  '保存できませんでした。通信を確かめて、時間をおいてやり直してください。'

type AdminFormProps = {
  title: string
  /** 一覧の項目の中に置くときは3にする。見出しの階層を飛ばさないため */
  titleLevel?: 2 | 3
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  failure: string | null
  submitting: boolean
  /** 渡すとキャンセルボタンが出る。編集フォームを閉じるのに使う */
  onCancel?: (() => void) | undefined
  children: ReactNode
}

/**
 * フォームの外枠。`noValidate` でブラウザ標準の検証を止める。標準の検証は
 * スキーマと許す範囲が違い（`ftp://` を通すなど）文言も揃わないので、
 * 何が悪いかを伝えるのはスキーマ側だけに任せる。
 */
export function AdminForm({
  title,
  titleLevel = 2,
  onSubmit,
  failure,
  submitting,
  onCancel,
  children,
}: AdminFormProps) {
  return (
    <Paper
      component="form"
      noValidate
      onSubmit={onSubmit}
      withBorder
      p="md"
      radius="md"
      bg="var(--app-surface)"
      style={{ borderColor: 'var(--app-border)' }}
    >
      <Stack gap="md">
        <Title order={titleLevel}>{title}</Title>
        {children}
        <FormError message={failure} />

        <Group grow>
          <Button type="submit" disabled={submitting}>
            {submitting ? '保存中…' : '保存'}
          </Button>
          {onCancel && (
            <Button type="button" variant="default" onClick={onCancel}>
              キャンセル
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  )
}

type FieldProps = {
  id: string
  label: string
  error?: string | undefined
  hint?: ReactNode
  children: ReactNode
}

/** 入力欄1つ分。エラー文とヒントの置き場所を全画面で揃えるために必ずこれを通す */
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <Stack gap={4}>
      <Text component="label" htmlFor={id} size="sm" fw={500}>
        {label}
      </Text>
      {children}
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
      {error && (
        <Text size="sm" c="red" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  )
}

/** 項目に紐づかない失敗（通信や保存そのものの失敗）の表示 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <Alert color="red" variant="light" role="alert">
      {message}
    </Alert>
  )
}

type AdminFormOptions<Input, Output, Result> = {
  /** サーバ関数と同じスキーマを渡す。入力の可否とエラー文を両側で一致させる */
  schema: z.ZodType<Output, Input>
  action: (value: Input) => Promise<Result>
  /** サーバが返した業務エラーを、フォームに表示する文言へ変換する */
  getResultFailure?: (result: Result) => string | null
  /**
   * 渡すと検証エラーをフィールド別ではなくフォーム全体の文言にする。
   * 一括行のように「何行目か」を先に伝えたいときに使う。
   */
  formatValidationFailure?: (error: z.ZodError) => string
  /** 保存できたときだけ呼ぶ。編集フォームを閉じる、入力欄を空に戻すなど */
  onSaved?: (result: Result) => void
}

export function actionResultFailure<Result>(
  result: Result,
  getResultFailure?: (result: Result) => string | null,
): string | null {
  return getResultFailure?.(result) ?? null
}

export function adminFormValidationState(
  error: z.ZodError,
  formatValidationFailure?: (error: z.ZodError) => string,
): { errors: FieldErrors; failure: string | null } {
  if (formatValidationFailure) {
    return { errors: {}, failure: formatValidationFailure(error) }
  }
  return { errors: fieldErrors(error), failure: null }
}

/**
 * 管理画面のフォームの共通処理。検証 → 保存 → 画面の作り直しまでを1か所に置く。
 * 画面ごとに書くと、保存後の作り直しやエラー表示の付け忘れに気づけない。
 */
export function useAdminForm<Input, Output, Result>({
  schema,
  action,
  getResultFailure,
  formatValidationFailure,
  onSaved,
}: AdminFormOptions<Input, Output, Result>) {
  const refresh = useRefresh()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(input: Input): Promise<void> {
    setFailure(null)

    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      const next = adminFormValidationState(
        parsed.error,
        formatValidationFailure,
      )
      setErrors(next.errors)
      setFailure(next.failure)
      return
    }

    setErrors({})
    setSubmitting(true)
    let saved: Result
    try {
      // 検証を通った値ではなく入力そのものを送る。空欄を null に寄せるといった
      // 正規化はサーバ側の検証で行い、そこを唯一の正とする
      const result = await action(input)
      const resultFailure = actionResultFailure(result, getResultFailure)
      if (resultFailure) {
        setFailure(resultFailure)
        try {
          await refresh()
        } catch {
          // 業務エラー表示を優先。refresh 失敗で上書きしない
        }
        return
      }
      saved = result
    } catch {
      setFailure(FAILURE_MESSAGE)
      return
    } finally {
      setSubmitting(false)
    }

    try {
      await refresh()
    } catch {
      // 保存は成功している。一覧再取得だけ失敗しても保存失敗扱いにしない
    }
    onSaved?.(saved)
  }

  /** 送信時に入力欄の値を集める。React の state から組み立てる部分だけを画面側に残す */
  function onSubmit(collect: () => Input) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void submit(collect())
    }
  }

  return { errors, failure, submitting, onSubmit }
}

/**
 * 削除や並べ替えのように入力欄を持たない操作。フォームと同じ後片付けを通す。
 */
export function useAdminAction() {
  const refresh = useRefresh()
  const [failure, setFailure] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function run(action: () => Promise<unknown>): Promise<void> {
    setFailure(null)
    setRunning(true)
    try {
      await action()
    } catch {
      setFailure(FAILURE_MESSAGE)
      return
    } finally {
      setRunning(false)
    }

    try {
      await refresh()
    } catch {
      // 操作は成功。refresh 失敗で失敗メッセージを出さない
    }
  }

  return { failure, running, run }
}

function useRefresh() {
  const router = useRouter()

  return async function refresh(): Promise<void> {
    // 演奏会の一覧はクライアントに持たせてある（ADR-0005 と同じ理由）。どの操作が
    // 一覧に響くかを覚えておくより、更新のたびに捨てる方が取り違えない
    forgetConcerts()
    await router.invalidate()
  }
}
