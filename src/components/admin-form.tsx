import { useRouter } from '@tanstack/react-router'
import { type FormEvent, type ReactNode, useState } from 'react'
import type { z } from 'zod'
import { forgetConcerts } from '../concerts/concert-cache'
import { type FieldErrors, fieldErrors } from '../lib/validation'

const FAILURE_MESSAGE =
  '保存できませんでした。通信を確かめて、時間をおいてやり直してください。'

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
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** 項目に紐づかない失敗（通信や保存そのものの失敗）の表示 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <p className="error" role="alert">
      {message}
    </p>
  )
}

type AdminFormOptions<Input, Output> = {
  /** サーバ関数と同じスキーマを渡す。入力の可否とエラー文を両側で一致させる */
  schema: z.ZodType<Output, Input>
  action: (value: Input) => Promise<unknown>
  /** 保存できたときだけ呼ぶ。編集フォームを閉じる、入力欄を空に戻すなど */
  onSaved?: () => void
}

/**
 * 管理画面のフォームの共通処理。検証 → 保存 → 画面の作り直しまでを1か所に置く。
 * 画面ごとに書くと、保存後の作り直しやエラー表示の付け忘れに気づけない。
 */
export function useAdminForm<Input, Output>({
  schema,
  action,
  onSaved,
}: AdminFormOptions<Input, Output>) {
  const refresh = useRefresh()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(input: Input): Promise<void> {
    setFailure(null)

    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      // 検証を通った値ではなく入力そのものを送る。空欄を null に寄せるといった
      // 正規化はサーバ側の検証で行い、そこを唯一の正とする
      await action(input)
      await refresh()
      onSaved?.()
    } catch {
      setFailure(FAILURE_MESSAGE)
    } finally {
      setSubmitting(false)
    }
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
      await refresh()
    } catch {
      setFailure(FAILURE_MESSAGE)
    } finally {
      setRunning(false)
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
