import { describe, expect, it } from 'vitest'
import { resolveConcertId, type SelectableConcert } from './selection'

const TODAY = '2026-07-27'

function concert(
  id: number,
  overrides: Partial<SelectableConcert> = {},
): SelectableConcert {
  return {
    id,
    performanceDate: null,
    status: 'active',
    createdAt: `2026-01-${String(id).padStart(2, '0')}T00:00:00.000Z`,
    ...overrides,
  }
}

function resolve(
  concerts: Array<SelectableConcert>,
  overrides: { requested?: number; remembered?: number } = {},
) {
  return resolveConcertId({
    concerts,
    requested: overrides.requested,
    remembered: overrides.remembered,
    today: TODAY,
  })
}

describe('resolveConcertId', () => {
  it('演奏会が無ければ null', () => {
    expect(resolve([])).toBeNull()
  })

  it('クエリの指定を最優先する', () => {
    const concerts = [
      concert(1, { performanceDate: '2026-08-01' }),
      concert(2, { performanceDate: '2026-09-01' }),
    ]

    expect(resolve(concerts, { requested: 2, remembered: 1 })).toBe(2)
  })

  it('アーカイブ済みでもクエリで指定されれば選ぶ', () => {
    const concerts = [
      concert(1, { performanceDate: '2026-08-01' }),
      concert(2, { performanceDate: '2026-01-01', status: 'archived' }),
    ]

    expect(resolve(concerts, { requested: 2 })).toBe(2)
  })

  it('クエリが存在しない id なら Cookie の値へ進む', () => {
    const concerts = [concert(1), concert(2)]

    expect(resolve(concerts, { requested: 99, remembered: 2 })).toBe(2)
  })

  it('クエリが無ければ Cookie の値を使う', () => {
    const concerts = [
      concert(1, { performanceDate: '2026-08-01' }),
      concert(2, { performanceDate: '2026-01-01', status: 'archived' }),
    ]

    expect(resolve(concerts, { remembered: 2 })).toBe(2)
  })

  it('Cookie が存在しない id なら進行中の直近へ進む', () => {
    const concerts = [
      concert(1, { performanceDate: '2026-09-01' }),
      concert(2, { performanceDate: '2026-08-01' }),
    ]

    expect(resolve(concerts, { remembered: 99 })).toBe(2)
  })

  it('進行中のうち本番日が今日以降で最も近いものを選ぶ', () => {
    const concerts = [
      concert(1, { performanceDate: '2026-12-01' }),
      concert(2, { performanceDate: '2026-07-28' }),
      concert(3, { performanceDate: '2026-07-26' }),
    ]

    expect(resolve(concerts)).toBe(2)
  })

  it('本番日が今日のものは将来として扱う', () => {
    const concerts = [
      concert(1, { performanceDate: '2026-08-01' }),
      concert(2, { performanceDate: TODAY }),
    ]

    expect(resolve(concerts)).toBe(2)
  })

  it('アーカイブ済みは直近の判定から外す', () => {
    const concerts = [
      concert(1, { performanceDate: '2026-08-01' }),
      concert(2, { performanceDate: '2026-07-28', status: 'archived' }),
    ]

    expect(resolve(concerts)).toBe(1)
  })

  it('本番日が全て過去なら最新に作られたものを選ぶ', () => {
    const concerts = [
      concert(1, {
        performanceDate: '2026-07-01',
        createdAt: '2026-05-01T00:00:00.000Z',
      }),
      concert(2, {
        performanceDate: '2026-07-20',
        createdAt: '2026-03-01T00:00:00.000Z',
      }),
    ]

    expect(resolve(concerts)).toBe(1)
  })

  it('本番日が未設定でも最新に作られたものへ落ちる', () => {
    const concerts = [
      concert(1, { createdAt: '2026-05-01T00:00:00.000Z' }),
      concert(2, { createdAt: '2026-06-01T00:00:00.000Z' }),
    ]

    expect(resolve(concerts)).toBe(2)
  })
})
