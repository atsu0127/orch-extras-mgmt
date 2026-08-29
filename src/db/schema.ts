import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { MAX_LENGTH } from '../lib/limits'
import { ROLES } from '../lib/roles'

export const CONCERT_STATUSES = ['active', 'archived'] as const
export type ConcertStatus = (typeof CONCERT_STATUSES)[number]

export const LINK_TARGET_TYPES = ['bowing'] as const
export type LinkTargetType = (typeof LINK_TARGET_TYPES)[number]

export const LINK_VERDICTS = ['ok', 'broken', 'suspect', 'error'] as const
export type LinkVerdict = (typeof LINK_VERDICTS)[number]

const nowIso = () => new Date().toISOString()

// 列ビルダは組み込み時に変化するため、テーブルごとに新しいものを作る
const timestamps = () => ({
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(nowIso)
    .$onUpdateFn(nowIso),
})

export const venues = sqliteTable('venues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name', { length: MAX_LENGTH.venueName }).notNull(),
  address: text('address', { length: MAX_LENGTH.venueAddress }).notNull(),
  note: text('note', { length: MAX_LENGTH.venueNote }),
  ...timestamps(),
})

export const concerts = sqliteTable('concerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name', { length: MAX_LENGTH.concertName }).notNull(),
  performanceDate: text('performance_date'),
  venueId: integer('venue_id').references(() => venues.id, {
    onDelete: 'set null',
  }),
  attendanceUrl: text('attendance_url', { length: MAX_LENGTH.url }),
  attendanceNote: text('attendance_note', {
    length: MAX_LENGTH.attendanceNote,
  }),
  note: text('note', { length: MAX_LENGTH.concertNote }),
  status: text('status', { enum: CONCERT_STATUSES })
    .notNull()
    .default('active'),
  ...timestamps(),
})

export const concertResources = sqliteTable(
  'concert_resources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    concertId: integer('concert_id')
      .notNull()
      .references(() => concerts.id, { onDelete: 'cascade' }),
    title: text('title', { length: MAX_LENGTH.resourceTitle }).notNull(),
    url: text('url', { length: MAX_LENGTH.url }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('concert_resources_concert_sort_idx').on(t.concertId, t.sortOrder),
  ],
)

export const announcements = sqliteTable(
  'announcements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    concertId: integer('concert_id')
      .notNull()
      .references(() => concerts.id, { onDelete: 'cascade' }),
    title: text('title', { length: MAX_LENGTH.announcementTitle }).notNull(),
    body: text('body', { length: MAX_LENGTH.announcementBody }).notNull(),
    url: text('url', { length: MAX_LENGTH.url }),
    ...timestamps(),
  },
  (t) => [
    index('announcements_concert_created_idx').on(t.concertId, t.createdAt),
  ],
)

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  adminEmail: text('admin_email', { length: MAX_LENGTH.adminEmail }),
  ...timestamps(),
})

export const practices = sqliteTable(
  'practices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    concertId: integer('concert_id')
      .notNull()
      .references(() => concerts.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    startTime: text('start_time'),
    endTime: text('end_time'),
    venueId: integer('venue_id').references(() => venues.id, {
      onDelete: 'set null',
    }),
    detail: text('detail', { length: MAX_LENGTH.practiceDetail }),
    ...timestamps(),
  },
  (t) => [index('practices_concert_date_idx').on(t.concertId, t.date)],
)

export const practiceMedia = sqliteTable(
  'practice_media',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    practiceId: integer('practice_id')
      .notNull()
      .references(() => practices.id, { onDelete: 'cascade' }),
    title: text('title', { length: MAX_LENGTH.mediaTitle }).notNull(),
    url: text('url', { length: MAX_LENGTH.url }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('practice_media_practice_sort_idx').on(t.practiceId, t.sortOrder),
  ],
)

export const pieces = sqliteTable(
  'pieces',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    concertId: integer('concert_id')
      .notNull()
      .references(() => concerts.id, { onDelete: 'cascade' }),
    title: text('title', { length: MAX_LENGTH.pieceTitle }).notNull(),
    composer: text('composer', { length: MAX_LENGTH.pieceComposer }),
    sortOrder: integer('sort_order').notNull().default(0),
    bowingUrl: text('bowing_url', { length: MAX_LENGTH.url }),
    scoreWithoutBowingUrl: text('score_without_bowing_url', {
      length: MAX_LENGTH.url,
    }),
    ...timestamps(),
  },
  (t) => [index('pieces_concert_sort_idx').on(t.concertId, t.sortOrder)],
)

export const linkChecks = sqliteTable(
  'link_checks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    targetType: text('target_type', { enum: LINK_TARGET_TYPES }).notNull(),
    targetId: integer('target_id').notNull(),
    url: text('url', { length: MAX_LENGTH.url }).notNull(),
    verdict: text('verdict', { enum: LINK_VERDICTS }).notNull(),
    httpStatus: integer('http_status'),
    detail: text('detail'),
    checkedAt: text('checked_at').notNull().$defaultFn(nowIso),
  },
  (t) => [
    // 対象ごとに最新1件だけを持ち、履歴は残さない（設計書6.1）
    uniqueIndex('link_checks_target_unique').on(t.targetType, t.targetId),
  ],
)

export const credentials = sqliteTable('credentials', {
  role: text('role', { enum: ROLES }).primaryKey(),
  passwordHash: text('password_hash').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(nowIso)
    .$onUpdateFn(nowIso),
})

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    role: text('role', { enum: ROLES }).notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    expiresAt: text('expires_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull().$defaultFn(nowIso),
  },
  (t) => [index('sessions_expires_at_idx').on(t.expiresAt)],
)

export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ip: text('ip').notNull(),
    attemptedAt: text('attempted_at').notNull().$defaultFn(nowIso),
    success: integer('success', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('login_attempts_ip_attempted_at_idx').on(t.ip, t.attemptedAt)],
)

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert
export type Concert = typeof concerts.$inferSelect
export type NewConcert = typeof concerts.$inferInsert
export type ConcertResource = typeof concertResources.$inferSelect
export type NewConcertResource = typeof concertResources.$inferInsert
export type Announcement = typeof announcements.$inferSelect
export type NewAnnouncement = typeof announcements.$inferInsert
export type AppSetting = typeof appSettings.$inferSelect
export type NewAppSetting = typeof appSettings.$inferInsert
export type Practice = typeof practices.$inferSelect
export type NewPractice = typeof practices.$inferInsert
export type PracticeMedium = typeof practiceMedia.$inferSelect
export type NewPracticeMedium = typeof practiceMedia.$inferInsert
export type Piece = typeof pieces.$inferSelect
export type NewPiece = typeof pieces.$inferInsert
export type LinkCheck = typeof linkChecks.$inferSelect
export type NewLinkCheck = typeof linkChecks.$inferInsert
export type Credential = typeof credentials.$inferSelect
export type NewCredential = typeof credentials.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export const aiUsageDaily = sqliteTable(
  'ai_usage_daily',
  {
    usageDate: text('usage_date').notNull(),
    model: text('model').notNull(),
    acceptedQuestionCount: integer('accepted_question_count')
      .notNull()
      .default(0),
    apiRequestCount: integer('api_request_count').notNull().default(0),
    successfulQuestionCount: integer('successful_question_count')
      .notNull()
      .default(0),
    failedQuestionCount: integer('failed_question_count').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  },
  (t) => [primaryKey({ columns: [t.usageDate, t.model] })],
)

export const aiAskAttempts = sqliteTable(
  'ai_ask_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ip: text('ip').notNull(),
    attemptedAt: text('attempted_at').notNull().$defaultFn(nowIso),
  },
  (t) => [index('ai_ask_attempts_ip_attempted_at_idx').on(t.ip, t.attemptedAt)],
)

export type LoginAttempt = typeof loginAttempts.$inferSelect
export type NewLoginAttempt = typeof loginAttempts.$inferInsert
export type AiUsageDaily = typeof aiUsageDaily.$inferSelect
export type NewAiUsageDaily = typeof aiUsageDaily.$inferInsert
export type AiAskAttempt = typeof aiAskAttempts.$inferSelect
export type NewAiAskAttempt = typeof aiAskAttempts.$inferInsert
