/**
 * 文字数の上限（設計書6.1）。SQLite は text の長さを強制しないので、実際に効くのは
 * サーバ関数側の zod 検証（設計書6.3）。両者が食い違わないようここを唯一の出所にする。
 *
 * スキーマ定義とは別のファイルに置いている。フォームの検証はブラウザでも走るため、
 * ここを読むだけで drizzle がクライアントのバンドルに載ってしまうのを避ける。
 */
export const MAX_LENGTH = {
  venueName: 100,
  venueAddress: 200,
  venueNote: 500,
  concertName: 100,
  attendanceNote: 500,
  concertNote: 2000,
  resourceTitle: 100,
  adminEmail: 254,
  practiceDetail: 2000,
  mediaTitle: 100,
  pieceTitle: 100,
  pieceComposer: 100,
  url: 2000,
} as const

export const MAX_CONCERT_RESOURCES = 5

export const CONCERT_RESOURCE_LIMIT_MESSAGE = `資料は${MAX_CONCERT_RESOURCES}件まで登録できます`
