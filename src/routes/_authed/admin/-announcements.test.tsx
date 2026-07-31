import { describe, expect, it } from 'vitest'
import { announcementCreateFormKey } from './announcements'

describe('announcementCreateFormKey', () => {
  it('演奏会ごとに違う key を返し、追加フォームを作り直せる', () => {
    expect(announcementCreateFormKey(1)).toBe('1')
    expect(announcementCreateFormKey(2)).toBe('2')
    expect(announcementCreateFormKey(1)).not.toBe(announcementCreateFormKey(2))
  })
})
