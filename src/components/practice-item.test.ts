import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PracticeItem } from './practice-item'

const practice = {
  id: 1,
  date: '2026-11-01',
  startTime: '13:00',
  endTime: '16:00',
  detail: null,
  venue: {
    name: '市民ホール',
    address: '東京都 千代田区1-1 &別館#2',
    note: null,
  },
  media: [],
}

describe('PracticeItem', () => {
  it('会場があるとき住所の後にGoogle Mapsリンクを表示する', () => {
    const html = renderToStaticMarkup(createElement(PracticeItem, { practice }))

    expect(html).toContain(
      'href="https://www.google.com/maps/search/?api=1&amp;query=%E6%9D%B1%E4%BA%AC%E9%83%BD%20%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA1-1%20%26%E5%88%A5%E9%A4%A8%232" target="_blank" rel="noopener noreferrer"',
    )
    expect(html.indexOf('東京都 千代田区1-1')).toBeLessThan(
      html.indexOf('Google Mapsで開く'),
    )
  })

  it('会場がないときGoogle Mapsリンクを表示しない', () => {
    const html = renderToStaticMarkup(
      createElement(PracticeItem, {
        practice: { ...practice, venue: null },
      }),
    )

    expect(html).toContain('会場は未定です。')
    expect(html).not.toContain('Google Mapsで開く')
    expect(html).not.toContain('google.com/maps')
  })
})
