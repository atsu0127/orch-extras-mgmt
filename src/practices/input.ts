import { z } from 'zod'
import { MAX_LENGTH } from '../lib/limits'
import {
  optionalId,
  optionalText,
  optionalTime,
  requiredDate,
} from '../lib/validation'

/**
 * 練習の入力。サーバ関数とフォームで共有する。
 *
 * 日付と時刻は日本時間の文字列のまま扱うので、前後の判定も文字列の比較で足りる
 * （設計書5.4）。
 */
export const practiceInput = z
  .object({
    date: requiredDate,
    startTime: optionalTime,
    endTime: optionalTime,
    venueId: optionalId,
    detail: optionalText(MAX_LENGTH.practiceDetail),
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
