import {
  index,
  integer,
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
  status: text('status', { enum: CONCERT_STATUSES })
    .notNull()
    .default('active'),
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
export type LoginAttempt = typeof loginAttempts.$inferSelect
export type NewLoginAttempt = typeof loginAttempts.$inferInsert
