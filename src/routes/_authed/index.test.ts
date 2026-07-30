import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', async () => {
  return {
    createFileRoute:
      () =>
      (options: object): object => ({
        ...options,
        useLoaderData: vi.fn(),
        useRouteContext: vi.fn(),
      }),
    Link: ({
      children,
      className,
      to,
    }: {
      children: ReactNode
      className?: string
      to: string
    }) => createElement('a', { className, href: to }, children),
  }
})

vi.mock('@tanstack/react-start', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-start')>()
  return {
    ...actual,
    createServerFn: () => {
      const builder = {
        middleware: () => builder,
        validator: () => builder,
        handler: () => vi.fn(),
      }
      return builder
    },
  }
})

import { DashboardContent } from './index'

const concert = {
  id: 1,
  name: '第10回定期演奏会',
  performanceDate: '2026-12-01',
  attendanceUrl: 'https://example.com/attendance',
  attendanceNote: null,
  note: '集合は13時です\n黒服を持参してください',
  venueName: '市民ホール',
  venueAddress: '東京都1-1',
}

const nextPractice = {
  id: 1,
  date: '2026-11-01',
  startTime: '13:00',
  endTime: '16:00',
  detail: null,
  venue: null,
  media: [],
}

describe('DashboardContent', () => {
  it('本番会場の住所があるときGoogle Mapsリンクを表示する', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert,
        nextPractice,
        resources: [],
      }),
    )

    expect(html).toContain(
      'href="https://www.google.com/maps/search/?api=1&amp;query=%E6%9D%B1%E4%BA%AC%E9%83%BD1-1" target="_blank" rel="noopener noreferrer"',
    )
    expect(html).toContain('Google Mapsで開く')
  })

  it('本番会場の住所がないときGoogle Mapsリンクを表示しない', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert: { ...concert, venueAddress: null },
        nextPractice,
        resources: [],
      }),
    )

    expect(html).not.toContain('Google Mapsで開く')
    expect(html).not.toContain('google.com/maps')
  })

  it('次の練習と出欠の間に改行付き備考と資料を受け取った順で表示する', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert,
        nextPractice,
        resources: [
          {
            id: 10,
            title: '演奏会のしおり',
            url: 'https://example.com/guide',
          },
          {
            id: 11,
            title: '座席表',
            url: 'https://example.com/seats',
          },
        ],
      }),
    )

    expect(html).toContain(
      '<p class="detail">集合は13時です\n黒服を持参してください</p>',
    )
    expect(html).toContain('<ul class="link-list">')
    expect(html.indexOf('次の練習')).toBeLessThan(html.indexOf('備考'))
    expect(html.indexOf('備考')).toBeLessThan(html.indexOf('資料'))
    expect(html.indexOf('資料')).toBeLessThan(html.indexOf('出欠の回答'))
    expect(html.indexOf('演奏会のしおり')).toBeLessThan(html.indexOf('座席表'))
    expect(html).toContain(
      'href="https://example.com/guide" target="_blank" rel="noopener noreferrer"',
    )
  })

  it.each([null, ''])('備考が %s なら備考セクションを表示しない', (note) => {
    const html = renderToStaticMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert: { ...concert, note },
        nextPractice,
        resources: [],
      }),
    )

    expect(html).not.toContain('<h2>備考</h2>')
    expect(html).not.toContain('class="state"')
  })

  it('資料が空なら資料セクションを表示しない', () => {
    const html = renderToStaticMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert,
        nextPractice,
        resources: [],
      }),
    )

    expect(html).not.toContain('<h2>資料</h2>')
    expect(html).not.toContain('class="state"')
  })
})
