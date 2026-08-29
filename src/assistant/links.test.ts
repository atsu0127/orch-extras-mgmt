import { describe, expect, it } from 'vitest'
import { parseInternalAssistantHref } from './links'

describe('parseInternalAssistantHref', () => {
  it('登録した内部ルートだけを通す', () => {
    expect(parseInternalAssistantHref('/practices?concert=3')).toEqual({
      to: '/practices',
      concert: 3,
    })
    expect(parseInternalAssistantHref('https://example.com/x')).toBeNull()
    expect(parseInternalAssistantHref('/admin?concert=1')).toBeNull()
  })
})
