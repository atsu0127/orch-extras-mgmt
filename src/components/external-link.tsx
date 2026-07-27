import type { ReactNode } from 'react'

type ExternalLinkProps = {
  href: string
  className?: string
  children: ReactNode
}

/**
 * 外部サービスへのリンク。`rel="noopener noreferrer"` の付け忘れを防ぐため、
 * 外部へ飛ぶリンクはすべてここを通す（設計書8.5）。
 */
export function ExternalLink({ href, className, children }: ExternalLinkProps) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}
