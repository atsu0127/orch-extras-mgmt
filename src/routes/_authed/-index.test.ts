import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderMarkup } from '../../test/render'

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
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert,
        nextPractice: null,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).toContain(
      'href="https://www.google.com/maps/search/?api=1&amp;query=%E6%9D%B1%E4%BA%AC%E9%83%BD1-1" target="_blank" rel="noopener noreferrer"',
    )
    expect(html).toContain('地図を開く')
  })

  it('本番会場の住所がないときGoogle Mapsリンクを表示しない', () => {
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert: { ...concert, venueAddress: null },
        nextPractice: null,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).not.toContain('地図を開く')
    expect(html).not.toContain('google.com/maps')
  })

  it('本番会場がなくても有効な本番日ならGoogleカレンダーリンクを表示する', () => {
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert: { ...concert, venueName: null, venueAddress: null },
        nextPractice: null,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).toContain('予定に追加')
    const href = html.match(
      /href="(https:\/\/calendar\.google\.com\/calendar\/render[^"]+)"/,
    )?.[1]
    expect(href).toBeDefined()
    const parsed = new URL(href?.replaceAll('&amp;', '&') ?? '')
    expect(parsed.searchParams.get('text')).toBe('第10回定期演奏会')
    expect(parsed.searchParams.get('dates')).toBe('20261201/20261202')
    expect(parsed.searchParams.has('location')).toBe(false)
  })

  it('本番日が不正ならGoogleカレンダーリンクを表示しない', () => {
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert: { ...concert, performanceDate: '2026-02-30' },
        nextPractice: null,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).not.toContain('予定に追加')
    expect(html).not.toContain('calendar.google.com')
  })

  it('次の練習のあとにお知らせ・本番・出欠・備考・資料の順で表示する', () => {
    const html = renderMarkup(
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
        announcements: [
          {
            id: 2,
            title: '新しいお知らせ',
            body: '最新の本文',
            url: 'https://example.com/latest',
            createdAt: '2026-07-30T12:00:00.000Z',
          },
          {
            id: 1,
            title: '古いお知らせ',
            body: '過去の本文',
            url: null,
            createdAt: '2026-07-20T12:00:00.000Z',
          },
        ],
      }),
    )

    expect(html).toContain(
      '<p class="detail pamphlet-note">集合は13時です\n黒服を持参してください</p>',
    )
    expect(html.indexOf('次の練習')).toBeLessThan(html.indexOf('お知らせ'))
    expect(html.indexOf('お知らせ')).toBeLessThan(html.indexOf('本番'))
    expect(html.indexOf('新しいお知らせ')).toBeLessThan(
      html.indexOf('古いお知らせ'),
    )
    expect(html.indexOf('本番')).toBeLessThan(html.indexOf('出欠の回答'))
    expect(html.indexOf('出欠の回答')).toBeLessThan(html.indexOf('備考'))
    expect(html.indexOf('備考')).toBeLessThan(html.indexOf('資料'))
    expect(html.indexOf('演奏会のしおり')).toBeLessThan(html.indexOf('座席表'))
    expect(html).toContain(
      'href="https://example.com/guide" target="_blank" rel="noopener noreferrer"',
    )
    expect(html).toContain(
      'href="https://example.com/latest" target="_blank" rel="noopener noreferrer"',
    )
  })

  it.each([null, ''])('備考が %s なら備考セクションを表示しない', (note) => {
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert: { ...concert, note },
        nextPractice,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).not.toContain('備考')
  })

  it('資料が空なら資料セクションを表示しない', () => {
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert,
        nextPractice,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).not.toContain('>資料<')
    expect(html).not.toContain('演奏会のしおり')
  })

  it('お知らせが空ならお知らせセクションを表示しない', () => {
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: null },
        concert,
        nextPractice,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).not.toContain('>お知らせ<')
    expect(html).not.toContain('新しいお知らせ')
  })

  it('問い合わせは出欠と同じ外部リンクボタンとして表示する', () => {
    const html = renderMarkup(
      createElement(DashboardContent, {
        appSettings: { adminEmail: 'admin@example.com' },
        concert,
        nextPractice: null,
        resources: [],
        announcements: [],
      }),
    )

    expect(html).toContain('出欠を回答する')
    expect(html).toContain('管理者へ問い合わせる')
    expect(html).toContain('mailto:admin@example.com')
    expect(html).toContain('target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('external-link-icon')
  })
})
