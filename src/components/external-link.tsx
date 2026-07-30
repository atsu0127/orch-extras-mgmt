import { Anchor, Button } from '@mantine/core'
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
      >
        {children}
      </Button>
    )
  }

  return (
    <Anchor href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </Anchor>
  )
}
