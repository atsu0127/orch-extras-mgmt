import type { ErrorComponentProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  children?: ReactNode
}

/** データが無いときの表示。何が無いのかと、次に何をすればよいかを同じ形で見せる */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}

/** ルータの `defaultPendingComponent`。loader の待ち時間が長いときだけ出る */
export function PendingState() {
  return <output className="state">読み込み中です…</output>
}

/**
 * ルータの `defaultErrorComponent`。
 *
 * 例外の中身は出さない。サーバ関数の失敗理由には D1 のエラー文言などが混ざり、
 * 読む人の役に立たないうえに内部の構造を漏らす。
 */
export function ErrorState({ reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <div className="state" role="alert">
      <p className="state-title">表示できませんでした</p>
      <p>通信が不安定なときに起こります。時間をおいてやり直してください。</p>
      <button
        type="button"
        className="link-button"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        やり直す
      </button>
    </div>
  )
}
