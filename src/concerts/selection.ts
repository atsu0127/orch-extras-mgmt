import type { ConcertStatus } from '../db/schema'

export type SelectableConcert = {
  id: number
  performanceDate: string | null
  status: ConcertStatus
  createdAt: string
}

export type ConcertSelectionInput = {
  concerts: ReadonlyArray<SelectableConcert>
  /** URL のクエリで指定された演奏会。これが最優先 */
  requested: number | undefined
  /** Cookie `oem_concert` に残っている前回の選択 */
  remembered: number | undefined
  /** 日本時間の今日（`YYYY-MM-DD`） */
  today: string
}

/**
 * 設計書7.1の解決順。存在しない id を指してきた場合は、その指定が無かったものとして次へ進む。
 * 演奏会が1件も無ければ null を返す。
 */
export function resolveConcertId({
  concerts,
  requested,
  remembered,
  today,
}: ConcertSelectionInput): number | null {
  const selected =
    findById(concerts, requested) ??
    findById(concerts, remembered) ??
    nearestUpcoming(concerts, today) ??
    newestCreated(concerts)

  return selected?.id ?? null
}

function findById(
  concerts: ReadonlyArray<SelectableConcert>,
  id: number | undefined,
): SelectableConcert | undefined {
  if (id === undefined) return undefined
  return concerts.find((concert) => concert.id === id)
}

/** 進行中のうち、本番日が今日以降で最も近いもの */
function nearestUpcoming(
  concerts: ReadonlyArray<SelectableConcert>,
  today: string,
): SelectableConcert | undefined {
  let nearest: SelectableConcert | undefined
  let nearestDate: string | undefined

  for (const concert of concerts) {
    const date = concert.performanceDate
    if (concert.status !== 'active' || date === null || date < today) continue
    if (nearestDate === undefined || date < nearestDate) {
      nearest = concert
      nearestDate = date
    }
  }

  return nearest
}

function newestCreated(
  concerts: ReadonlyArray<SelectableConcert>,
): SelectableConcert | undefined {
  let newest: SelectableConcert | undefined

  for (const concert of concerts) {
    if (newest === undefined || concert.createdAt > newest.createdAt) {
      newest = concert
    }
  }

  return newest
}
