import { Anchor, Button } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type ExternalLinkProps = {
  href: string
  children: ReactNode
  /** 主要導線としてボタン風に見せるときだけ使う */
  action?: boolean
}

/**
 * 外部サービスへのリンク。`rel="noopener noreferrer"` の付け忘れを防ぐため、
 * 外部へ飛ぶリンクはすべてここを通す（設計書8.5）。
 * 閲覧時にタップ対象だと分かるよう、常時下線・リンク色・外部アイコンを付ける（T9-1）。
 */
export function ExternalLink({
  href,
  children,
  action = false,
}: ExternalLinkProps) {
  if (action) {
    return (
      <Button
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        fullWidth
        rightSection={
          <IconExternalLink
            className="external-link-icon"
            size={18}
            stroke={1.75}
            aria-hidden
          />
        }
      >
        {children}
      </Button>
    )
  }

  return (
    <Anchor
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="always"
      c="bordeaux"
      className="external-link"
    >
      <span className="external-link-label">{children}</span>
      <IconExternalLink
        className="external-link-icon"
        size={16}
        stroke={1.75}
        aria-hidden
      />
    </Anchor>
  )
}
