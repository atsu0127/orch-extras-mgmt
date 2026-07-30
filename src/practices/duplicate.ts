import type { PracticeAdminItem } from './queries'

export type PracticeFormValues = {
  date: string
  startTime: string
  endTime: string
  venueId: string
  detail: string
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
