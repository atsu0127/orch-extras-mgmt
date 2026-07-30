export const DIRECTIONS = ['up', 'down'] as const
export type Direction = (typeof DIRECTIONS)[number]

export type OrderedRow = {
  id: number
  sortOrder: number
}

/**
 * 並びの中で1つ隣と入れ替え、書き換えが必要な行だけを返す。端にいて動かせないときは空。
 *
 * `sort_order` は 0 からの連番として持つ。連番なら入れ替えで変わるのは2行だけなので、
 * 書き込みも2件で済む。飛んでいたり重なっていたりする値も、この計算を通ると連番に直る。
 */
export function reorderRows(
  rows: ReadonlyArray<OrderedRow>,
  id: number,
  direction: Direction,
): Array<OrderedRow> {
  const from = rows.findIndex((row) => row.id === id)
  const to = direction === 'up' ? from - 1 : from + 1

  const moved = rows[from]
  const swapped = rows[to]
  if (!moved || !swapped) return []

  return rows
    .map((row, index) => {
      if (index === from) return swapped
      if (index === to) return moved
      return row
    })
    .flatMap((row, index) =>
      row.sortOrder === index ? [] : [{ id: row.id, sortOrder: index }],
    )
}
