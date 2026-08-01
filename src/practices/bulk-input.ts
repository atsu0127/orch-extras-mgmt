import { z } from 'zod'
import {
  BULK_PRACTICE_LIMIT_MESSAGE,
  MAX_BULK_PRACTICES,
  MAX_LENGTH,
} from '../lib/limits'
import {
  idValue,
  optionalText,
  optionalTime,
  requiredDate,
  requiredText,
} from '../lib/validation'

export const bulkVenueNone = z.object({
  kind: z.literal('none'),
})

export const bulkVenueExisting = z.object({
  kind: z.literal('existing'),
  venueId: idValue,
})

export const bulkVenueNew = z.object({
  kind: z.literal('new'),
  name: requiredText(MAX_LENGTH.venueName),
  address: requiredText(MAX_LENGTH.venueAddress),
  note: optionalText(MAX_LENGTH.venueNote),
})

export const bulkVenueInput = z.discriminatedUnion('kind', [
  bulkVenueNone,
  bulkVenueExisting,
  bulkVenueNew,
])

export const bulkPracticeRowInput = z
  .object({
    date: requiredDate,
    startTime: optionalTime,
    endTime: optionalTime,
    detail: optionalText(MAX_LENGTH.practiceDetail),
    venue: bulkVenueInput,
  })
  .superRefine((value, ctx) => {
    if (
      value.startTime !== null &&
      value.endTime !== null &&
      value.endTime <= value.startTime
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: '終了時刻は開始時刻より後にしてください',
      })
    }
  })

export const bulkPracticesInput = z.object({
  concertId: idValue,
  rows: z
    .array(bulkPracticeRowInput)
    .min(1, '1件以上入力してください')
    .max(MAX_BULK_PRACTICES, BULK_PRACTICE_LIMIT_MESSAGE),
})

export type BulkVenueInput = z.output<typeof bulkVenueInput>
export type BulkPracticeRowInput = z.output<typeof bulkPracticeRowInput>
export type BulkPracticesInput = z.output<typeof bulkPracticesInput>
