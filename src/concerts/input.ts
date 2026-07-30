import { z } from 'zod'
import { MAX_LENGTH } from '../lib/limits'
import {
  optionalDate,
  optionalId,
  optionalText,
  optionalUrl,
  requiredText,
} from '../lib/validation'

export const concertInput = z.object({
  name: requiredText(MAX_LENGTH.concertName),
  performanceDate: optionalDate,
  venueId: optionalId,
  attendanceUrl: optionalUrl,
  attendanceNote: optionalText(MAX_LENGTH.attendanceNote),
  note: optionalText(MAX_LENGTH.concertNote),
})
