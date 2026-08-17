import { describe, expect, it } from 'vitest'
import { inferSearchInput } from './stub-client'

describe('inferSearchInput', () => {
  it('演奏会名の指定とトピックを質問から拾う', () => {
    expect(
      inferSearchInput('演奏会「室内楽の夕べ」の出欠はどこですか？'),
    ).toEqual({
      concert: '室内楽の夕べ',
      topics: ['concert'],
    })
  })

  it('該当が無ければ演奏会と練習を検索する', () => {
    expect(inferSearchInput('教えて')).toEqual({
      concert: null,
      topics: ['concert', 'practices'],
    })
  })
})
