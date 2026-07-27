import { describe, expect, it } from 'vitest'
import { splitPractices } from './schedule'

const TODAY = '2026-07-27'

function practice(id: number, date: string, startTime: string | null = null) {
  return { id, date, startTime }
}

function ids(practices: Array<{ id: number }>): Array<number> {
  return practices.map(({ id }) => id)
}

describe('splitPractices', () => {
  it('今日を境に分け、今日の練習は今後に入れる', () => {
    const { upcoming, past } = splitPractices(
      [
        practice(1, '2026-07-26'),
        practice(2, TODAY),
        practice(3, '2026-07-28'),
      ],
      TODAY,
    )

    expect(ids(upcoming)).toEqual([2, 3])
    expect(ids(past)).toEqual([1])
  })

  it('今後は早い順に並べる', () => {
    const { upcoming } = splitPractices(
      [
        practice(1, '2026-09-01'),
        practice(2, '2026-07-28'),
        practice(3, '2026-08-15'),
      ],
      TODAY,
    )

    expect(ids(upcoming)).toEqual([2, 3, 1])
  })

  it('過去は新しい順に並べる', () => {
    const { past } = splitPractices(
      [
        practice(1, '2026-05-01'),
        practice(2, '2026-07-26'),
        practice(3, '2026-06-10'),
      ],
      TODAY,
    )

    expect(ids(past)).toEqual([2, 3, 1])
  })

  it('同じ日は開始時刻で並べる', () => {
    const { upcoming, past } = splitPractices(
      [
        practice(1, '2026-07-28', '18:30'),
        practice(2, '2026-07-28', '10:00'),
        practice(3, '2026-07-20', '18:30'),
        practice(4, '2026-07-20', '10:00'),
      ],
      TODAY,
    )

    expect(ids(upcoming)).toEqual([2, 1])
    expect(ids(past)).toEqual([3, 4])
  })

  it('開始時刻が未設定でも並び順が壊れない', () => {
    const { upcoming } = splitPractices(
      [practice(1, '2026-07-28', '10:00'), practice(2, '2026-07-28', null)],
      TODAY,
    )

    expect(ids(upcoming)).toEqual([2, 1])
  })

  it('元の配列を書き換えない', () => {
    const practices = [practice(1, '2026-09-01'), practice(2, '2026-07-28')]

    splitPractices(practices, TODAY)

    expect(ids(practices)).toEqual([1, 2])
  })

  it('空でも落ちない', () => {
    expect(splitPractices([], TODAY)).toEqual({ upcoming: [], past: [] })
  })
})
