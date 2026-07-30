import { Button, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { FormError } from './admin-form'
import { ListItem } from './list-item'

type ControlRowProps = {
  children: ReactNode
  failure?: string | null
}

export function ControlRow({ children, failure = null }: ControlRowProps) {
  return (
    <Stack gap="xs" mt="sm">
      <Group gap="xs" wrap="wrap">
        {children}
      </Group>
      <FormError message={failure} />
    </Stack>
  )
}

type SecondaryButtonProps = {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  'aria-label'?: string
  type?: 'button' | 'submit'
}

export function SecondaryButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
  ...rest
}: SecondaryButtonProps) {
  return (
    <Button
      type={type}
      variant="default"
      size="compact-md"
      disabled={disabled}
      {...(onClick ? { onClick } : {})}
      {...rest}
    >
      {children}
    </Button>
  )
}

type MediaListProps = {
  title: string
  children: ReactNode
}

export function MediaList({ title, children }: MediaListProps) {
  return (
    <Stack gap="xs" mt="sm">
      <Text size="sm" c="dimmed">
        {title}
      </Text>
      <Stack gap="sm" component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
        {children}
      </Stack>
    </Stack>
  )
}

export function AdminList({ children }: { children: ReactNode }) {
  return (
    <Stack gap="sm" component="ul" p={0} m={0} style={{ listStyle: 'none' }}>
      {children}
    </Stack>
  )
}

export function AdminListItem({ children }: { children: ReactNode }) {
  return (
    <li>
      <ListItem>{children}</ListItem>
    </li>
  )
}
