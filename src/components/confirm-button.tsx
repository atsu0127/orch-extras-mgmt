import { Button, Group, Stack, Title } from '@mantine/core'
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
 * 背後を操作させない・フォーカスを閉じ込めるといった扱いが標準の実装で済む
 *（ADR-0010）。見た目だけ Mantine のボタンに揃える。
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
      <Button
        type="button"
        color="red"
        variant="outline"
        size="compact-md"
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </Button>

      <dialog ref={dialog} className="confirm-dialog">
        <Stack gap="md">
          <Title order={2} size="h3">
            {title}
          </Title>
          {description}
          <Group grow>
            <Button
              type="button"
              variant="default"
              disabled={running}
              onClick={() => dialog.current?.close()}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              color="red"
              variant="outline"
              disabled={running}
              onClick={() => void confirm()}
            >
              {running ? '処理中…' : confirmLabel}
            </Button>
          </Group>
        </Stack>
      </dialog>
    </>
  )
}
