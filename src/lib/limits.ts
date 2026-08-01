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
  announcementTitle: 100,
  announcementBody: 1000,
  url: 2000,
} as const

export const MAX_CONCERT_RESOURCES = 5

export const CONCERT_RESOURCE_LIMIT_MESSAGE = `資料は${MAX_CONCERT_RESOURCES}件まで登録できます`

export const MAX_ANNOUNCEMENTS = 10

export const ANNOUNCEMENT_LIMIT_MESSAGE = `お知らせは${MAX_ANNOUNCEMENTS}件まで登録できます`

/** 練習一括作成の1回あたり上限（docs/practice-bulk-create/design.md） */
export const MAX_BULK_PRACTICES = 30

export const BULK_PRACTICE_LIMIT_MESSAGE = `一度に登録できる練習は${MAX_BULK_PRACTICES}件までです`

export const BULK_PRACTICE_UNKNOWN_VENUE_MESSAGE =
  '選択した会場が見つかりません'

export const BULK_PRACTICE_UNKNOWN_CONCERT_MESSAGE = '演奏会が見つかりません'
