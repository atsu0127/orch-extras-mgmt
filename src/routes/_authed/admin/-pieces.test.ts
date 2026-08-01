import { describe, expect, it } from 'vitest'
import { pieceCreateFormKey } from './pieces'

describe('pieceCreateFormKey', () => {
  it('演奏会ごとに違う key を返し、追加フォームを作り直せる', () => {
    expect(pieceCreateFormKey(1)).toBe('1')
    expect(pieceCreateFormKey(2)).toBe('2')
    expect(pieceCreateFormKey(1)).not.toBe(pieceCreateFormKey(2))
  })
})
