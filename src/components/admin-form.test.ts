import { describe, expect, it } from 'vitest'
import { actionResultFailure } from './admin-form'

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
