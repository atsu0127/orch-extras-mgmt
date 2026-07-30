import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, passwordChangeInput } from './input'

const valid = {
  currentPassword: 'current-password',
  newPassword: 'new-password-1234',
  confirmPassword: 'new-password-1234',
}

describe('passwordChangeInput', () => {
  it('3つ揃って一致していれば通る', () => {
    expect(passwordChangeInput.safeParse(valid).success).toBe(true)
  })

  it('確認用が違えば確認用の側で弾く', () => {
    const result = passwordChangeInput.safeParse({
      ...valid,
      confirmPassword: 'new-password-123',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('短すぎる新しいパスワードは弾く', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    const result = passwordChangeInput.safeParse({
      ...valid,
      newPassword: short,
      confirmPassword: short,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['newPassword'])
  })

  it('現在のパスワードが空なら弾く', () => {
    const result = passwordChangeInput.safeParse({
      ...valid,
      currentPassword: '',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['currentPassword'])
  })

  it('前後の空白は残す', () => {
    const padded = '  padded password  '
    const parsed = passwordChangeInput.parse({
      currentPassword: ' current ',
      newPassword: padded,
      confirmPassword: padded,
    })

    expect(parsed.currentPassword).toBe(' current ')
    expect(parsed.newPassword).toBe(padded)
  })
})
