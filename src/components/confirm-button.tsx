import { type ReactNode, useRef, useState } from 'react'

type ConfirmButtonProps = {
  label: string
  title: string
  /** 何が一緒に消えるかなど、押す前に知っておくべきこと */
  description?: ReactNode
  confirmLabel?: string
  disabled?: boolean
  onConfirm: () => Promise<void>
}

/**
 * 取り消せない操作の確認。ネイティブの `<dialog>` を使うので、Esc で閉じる・
 * 背後を操作させない・フォーカスを閉じ込めるといった扱いが標準の実装で済む。
 */
export function ConfirmButton({
  label,
  title,
  description,
  confirmLabel = '削除する',
  disabled = false,
  onConfirm,
}: ConfirmButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [running, setRunning] = useState(false)

  async function confirm() {
    setRunning(true)
    try {
      await onConfirm()
      dialog.current?.close()
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="danger"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>

      <dialog ref={dialog}>
        <h2>{title}</h2>
        {description}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary"
            disabled={running}
            onClick={() => dialog.current?.close()}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="danger"
            disabled={running}
            onClick={() => void confirm()}
          >
            {running ? '処理中…' : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  )
}
