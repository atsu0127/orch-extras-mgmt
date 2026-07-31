import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderMarkup } from '../test/render'
import { ExternalLink } from './external-link'

describe('ExternalLink', () => {
  it('通常リンクは常時下線・外部アイコン・noopener 付きで開く', () => {
    const html = renderMarkup(
      createElement(ExternalLink, {
        href: 'https://example.com/doc',
        children: '資料A',
      }),
    )

    expect(html).toContain(
      'href="https://example.com/doc" target="_blank" rel="noopener noreferrer"',
    )
    expect(html).toContain('data-underline="always"')
    expect(html).toContain('external-link-icon')
    expect(html).toContain('資料A')
  })

  it('action はボタン風にし、外部アイコンを付ける', () => {
    const html = renderMarkup(
      createElement(ExternalLink, {
        href: 'https://example.com/attend',
        action: true,
        children: '出欠を回答する',
      }),
    )

    expect(html).toContain('href="https://example.com/attend"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('出欠を回答する')
    expect(html).toContain('external-link-icon')
  })
})
