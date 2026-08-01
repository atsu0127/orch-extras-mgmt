import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { actionResultFailure, adminFormValidationState } from './admin-form'

type SaveResult = { ok: true } | { ok: false; reason: 'limit' }

const limitMessage = '上限に達しています'
const getResultFailure = (result: SaveResult) =>
  result.ok ? null : limitMessage

describe('actionResultFailure', () => {
  it('結果が業務エラーなら明示文言を返す', () => {
    expect(
      actionResultFailure<SaveResult>(
        { ok: false, reason: 'limit' },
        getResultFailure,
      ),
    ).toBe(limitMessage)
  })

  it('成功結果ならエラーなしと判定する', () => {
    expect(
      actionResultFailure<SaveResult>({ ok: true }, getResultFailure),
    ).toBeNull()
  })

  it('結果判定が指定されていなければエラーなしと判定する', () => {
    expect(actionResultFailure<SaveResult>({ ok: true })).toBeNull()
  })
})

describe('adminFormValidationState', () => {
  const schema = z.object({ name: z.string().min(1, '必須です') })

  it('既定ではフィールド別エラーにする', () => {
    const parsed = schema.safeParse({ name: '' })
    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(adminFormValidationState(parsed.error)).toEqual({
      errors: { name: '必須です' },
      failure: null,
    })
  })

  it('formatValidationFailure があればフォーム全体の文言にする', () => {
    const parsed = schema.safeParse({ name: '' })
    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(
      adminFormValidationState(
        parsed.error,
        (error) => `確認: ${error.issues[0]?.message ?? ''}`,
      ),
    ).toEqual({
      errors: {},
      failure: '確認: 必須です',
    })
  })
})
