import { Divider, Paper, Stack } from '@mantine/core'
import type { ReactNode } from 'react'

type ListItemProps = {
  children: ReactNode
}

/**
 * 日程や資料の1件。同形カードの多用を避け、区切り線と余白で階層を示す（設計書7.2）。
 */
export function ListItem({ children }: ListItemProps) {
  return (
    <Paper
      p="md"
      radius="md"
      bg="var(--app-surface)"
      style={{
        borderTop: '1px solid var(--app-border)',
        borderBottom: '1px solid var(--app-border)',
        borderLeft: 'none',
        borderRight: 'none',
      }}
    >
      {children}
    </Paper>
  )
}

type ItemControlsProps = {
  children: ReactNode
}

export function ItemControls({ children }: ItemControlsProps) {
  return (
    <Stack gap="xs" mt="sm">
      <Divider color="var(--app-border)" />
      <Stack gap="xs">{children}</Stack>
    </Stack>
  )
}
