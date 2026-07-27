import { z } from 'zod'
import { MESSAGES } from '../lib/validation'

/**
 * 共有パスワードなので個人アカウントのように使い回しの心配は無いが、総当たりに
 * 耐える長さは要る。ハッシュは反復の無い HMAC で（設計書8.2）、守りの多くを
 * 長さに頼っているため、短いものは受け付けない。
 */
export const MIN_PASSWORD_LENGTH = 12

/** ログイン入力と同じ上限。極端に長い入力でハッシュ計算を膨らませない */
const MAX_PASSWORD_LENGTH = 200

/**
 * パスワード変更の入力。前後の空白は落とさない。空白も文字として有効で、
 * 削るとログイン時に通らないものを登録してしまう。
 */
export const passwordChangeInput = z
  .object({
    currentPassword: z.string().min(1, MESSAGES.required),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `${MIN_PASSWORD_LENGTH}文字以上にしてください`)
      .max(MAX_PASSWORD_LENGTH, `${MAX_PASSWORD_LENGTH}文字以内にしてください`),
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.confirmPassword !== value.newPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: '新しいパスワードと一致しません',
      })
    }
  })
