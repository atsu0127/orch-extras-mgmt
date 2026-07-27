/**
 * ロールの一覧と画面での呼び名（設計書8.1）。
 *
 * `MAX_LENGTH` と同じ理由でスキーマ定義とは別のファイルに置いている。ロールは
 * 画面にも出るので、スキーマ側に置くと drizzle がクライアントのバンドルに載る。
 */
export const ROLES = ['admin', 'extra'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  admin: '管理者',
  extra: 'エキストラ',
}
