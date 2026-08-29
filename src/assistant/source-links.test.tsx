import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderMarkup } from '../test/render'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
    to,
  }: {
    children: ReactNode
    className?: string
    to: string
  }) => createElement('a', { className, href: to }, children),
}))

import { AssistantSourceLinks } from './source-links'

describe('AssistantSourceLinks', () => {
  it('外部URLは ExternalLink、内部は通常のリンクにする', () => {
    const html = renderMarkup(
      <AssistantSourceLinks
        links={[
          {
            key: 'attendance:1',
            label: '出欠を回答する',
            href: 'https://example.com/attendance',
            external: true,
          },
          {
            key: 'practice:1',
            label: '練習日程',
            href: '/practices?concert=1',
            external: false,
          },
        ]}
      />,
    )

    expect(html).toContain('根拠')
    expect(html).toContain('href="https://example.com/attendance"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('練習日程')
  })
})
