import { z } from 'zod'
import { MAX_LENGTH } from '../lib/limits'
import { optionalUrl, requiredText } from '../lib/validation'

export const announcementInput = z.object({
  title: requiredText(MAX_LENGTH.announcementTitle),
  body: requiredText(MAX_LENGTH.announcementBody),
  url: optionalUrl,
})

export type AnnouncementFields = z.infer<typeof announcementInput>
