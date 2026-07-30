import type { PracticeAdminItem } from './queries'

export type PracticeFormValues = {
  date: string
  startTime: string
  endTime: string
  venueId: string
  detail: string
}

export type DuplicatePracticeState = {
  concertId: number
  revision: number
  values: PracticeFormValues
}

export function duplicatePracticeValues(
  practice: PracticeAdminItem,
): PracticeFormValues {
  return {
    date: '',
    startTime: practice.startTime ?? '',
    endTime: practice.endTime ?? '',
    venueId: practice.venueId === null ? '' : String(practice.venueId),
    detail: practice.detail ?? '',
  }
}

export function createDuplicatePracticeState(
  current: DuplicatePracticeState | undefined,
  concertId: number,
  practice: PracticeAdminItem,
): DuplicatePracticeState {
  return {
    concertId,
    revision: (current?.revision ?? 0) + 1,
    values: duplicatePracticeValues(practice),
  }
}

export function duplicatePracticeValuesForConcert(
  state: DuplicatePracticeState | undefined,
  concertId: number,
): PracticeFormValues | undefined {
  return state?.concertId === concertId ? state.values : undefined
}
