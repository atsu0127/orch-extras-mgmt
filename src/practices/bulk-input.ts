import { z } from 'zod'
import {
  BULK_PRACTICE_LIMIT_MESSAGE,
  MAX_BULK_PRACTICES,
  MAX_LENGTH,
} from '../lib/limits'
import {
  idValue,
  optionalId,
  optionalText,
  optionalTime,
  requiredDate,
} from '../lib/validation'

export const bulkPracticeRowInput = z
  .object({
    date: requiredDate,
    startTime: optionalTime,
    endTime: optionalTime,
    detail: optionalText(MAX_LENGTH.practiceDetail),
    venueId: optionalId,
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

export type BulkPracticeRowInput = z.output<typeof bulkPracticeRowInput>
export type BulkPracticesInput = z.output<typeof bulkPracticesInput>
