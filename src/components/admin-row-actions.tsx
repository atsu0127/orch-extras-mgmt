import { ActionIcon, Group, Stack } from '@mantine/core'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { FormError } from './admin-form'
import { ConfirmButton } from './confirm-button'
import { SecondaryButton } from './control-row'

type AdminRowActionsProps = {
  failure?: string | null
  disabled?: boolean
  onEdit?: () => void
  editLabel?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  moveUpLabel: string
  moveDownLabel: string
  onDelete: () => Promise<void>
  deleteLabel?: string
  deleteTitle: string
  deleteDescription?: ReactNode
}

/**
 * 一覧の子行向け操作。↑↓はアイコンボタン、編集・削除はラベル付きにして
 * 1行に収め、スキャンしやすさを優先する（設計書13章 / T9-2）。
 */
export function AdminRowActions({
  failure = null,
  disabled = false,
  onEdit,
  editLabel = '編集',
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  moveUpLabel,
  moveDownLabel,
  onDelete,
  deleteLabel = '削除',
  deleteTitle,
  deleteDescription,
}: AdminRowActionsProps) {
  const showReorder = onMoveUp !== undefined || onMoveDown !== undefined

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap" className="admin-row-actions">
        {showReorder && (
          <Group gap={4} wrap="nowrap">
            <ActionIcon
              type="button"
              variant="default"
              size={44}
              aria-label={moveUpLabel}
              disabled={!canMoveUp || disabled || onMoveUp === undefined}
              {...(onMoveUp ? { onClick: onMoveUp } : {})}
            >
              <IconChevronUp size={20} stroke={1.75} aria-hidden />
            </ActionIcon>
            <ActionIcon
              type="button"
              variant="default"
              size={44}
              aria-label={moveDownLabel}
              disabled={!canMoveDown || disabled || onMoveDown === undefined}
              {...(onMoveDown ? { onClick: onMoveDown } : {})}
            >
              <IconChevronDown size={20} stroke={1.75} aria-hidden />
            </ActionIcon>
          </Group>
        )}
        {onEdit && (
          <SecondaryButton disabled={disabled} onClick={onEdit}>
            {editLabel}
          </SecondaryButton>
        )}
        <ConfirmButton
          label={deleteLabel}
          title={deleteTitle}
          {...(deleteDescription !== undefined
            ? { description: deleteDescription }
            : {})}
          disabled={disabled}
          onConfirm={onDelete}
        />
      </Group>
      <FormError message={failure} />
    </Stack>
  )
}

type AdminManagedLinkRowProps = {
  link: ReactNode
  actions: ReactNode
}

/** リンクタイトルと行アクションを横並びにし、狭い幅では折り返す */
export function AdminManagedLinkRow({
  link,
  actions,
}: AdminManagedLinkRowProps) {
  return (
    <div className="admin-managed-link-row">
      <div className="admin-managed-link-row-link">{link}</div>
      <div className="admin-managed-link-row-actions">{actions}</div>
    </div>
  )
}
