import { describe, expect, it } from 'vitest'
import { reorderRows } from './ordering'

const rows = [
  { id: 10, sortOrder: 0 },
  { id: 20, sortOrder: 1 },
  { id: 30, sortOrder: 2 },
]

describe('reorderRows', () => {
  it('上に動かすと入れ替わる2行だけを返す', () => {
    expect(reorderRows(rows, 30, 'up')).toEqual([
      { id: 30, sortOrder: 1 },
      { id: 20, sortOrder: 2 },
    ])
  })

  it('下に動かすと入れ替わる2行だけを返す', () => {
    expect(reorderRows(rows, 10, 'down')).toEqual([
      { id: 20, sortOrder: 0 },
      { id: 10, sortOrder: 1 },
    ])
  })

  it('先頭を上に、末尾を下には動かせない', () => {
    expect(reorderRows(rows, 10, 'up')).toEqual([])
    expect(reorderRows(rows, 30, 'down')).toEqual([])
  })

  it('知らない id は動かさない', () => {
    expect(reorderRows(rows, 99, 'up')).toEqual([])
    expect(reorderRows(rows, 99, 'down')).toEqual([])
  })

  it('値が重なっていても連番に直る', () => {
    const flat = [
      { id: 10, sortOrder: 0 },
      { id: 20, sortOrder: 0 },
      { id: 30, sortOrder: 0 },
    ]

    expect(reorderRows(flat, 20, 'up')).toEqual([
      { id: 10, sortOrder: 1 },
      { id: 30, sortOrder: 2 },
    ])
  })

  it('値が飛んでいても連番に直る', () => {
    const sparse = [
      { id: 10, sortOrder: 0 },
      { id: 20, sortOrder: 5 },
      { id: 30, sortOrder: 9 },
    ]

    expect(reorderRows(sparse, 20, 'down')).toEqual([
      { id: 30, sortOrder: 1 },
      { id: 20, sortOrder: 2 },
    ])
  })

  it('1件だけなら動かせない', () => {
    const single = [{ id: 10, sortOrder: 0 }]

    expect(reorderRows(single, 10, 'up')).toEqual([])
    expect(reorderRows(single, 10, 'down')).toEqual([])
  })
})
