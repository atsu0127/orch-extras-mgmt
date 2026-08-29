import { listAnnouncementsForConcert } from '../announcements/queries'
import { listConcertResources } from '../concert-resources/queries'
import {
  type ConcertOverview,
  getConcertOverview,
  listConcertOptions,
} from '../concerts/queries'
import type { Db } from '../db/client'
import {
  ASSISTANT_LIMITS,
  type SearchPortalInput,
  type SearchTopic,
  type SourceLink,
} from '../lib/assistant'
import { listPiecesForConcert } from '../pieces/queries'
import {
  listPracticesWithMedia,
  type PracticeEntry,
} from '../practices/queries'

export type SearchItem = {
  key: string
  topic: SearchTopic
  title: string
  summary: string
}

export type SearchPortalModelResult = {
  status: 'ok' | 'ambiguous' | 'not_found'
  concertName: string | null
  candidates: Array<{ name: string }>
  items: Array<SearchItem>
  truncated: boolean
}

export type SearchPortalExecution = {
  forModel: SearchPortalModelResult
  sources: Array<SourceLink>
}

export function normalizeConcertName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export async function searchPortal(
  db: Db,
  input: SearchPortalInput,
  selectedConcertId: number,
): Promise<SearchPortalExecution> {
  const resolved = await resolveConcert(db, input.concert, selectedConcertId)
  if (resolved.status === 'not_found') {
    return emptyResult('not_found')
  }
  if (resolved.status === 'ambiguous') {
    return {
      forModel: {
        status: 'ambiguous',
        concertName: null,
        candidates: resolved.candidates,
        items: [],
        truncated: false,
      },
      sources: [],
    }
  }

  const collected = await collectItems(db, resolved.concert, input)
  return limitResult(resolved.concert.name, collected)
}

function emptyResult(status: 'not_found' | 'ambiguous'): SearchPortalExecution {
  return {
    forModel: {
      status,
      concertName: null,
      candidates: [],
      items: [],
      truncated: false,
    },
    sources: [],
  }
}

async function resolveConcert(
  db: Db,
  concertQuery: string | null,
  selectedConcertId: number,
): Promise<
  | { status: 'ok'; concert: ConcertOverview }
  | { status: 'ambiguous'; candidates: Array<{ name: string }> }
  | { status: 'not_found' }
> {
  const query = concertQuery === null ? '' : normalizeConcertName(concertQuery)
  if (query === '') {
    const concert = await getConcertOverview(db, selectedConcertId)
    return concert ? { status: 'ok', concert } : { status: 'not_found' }
  }

  const options = await listConcertOptions(db)
  const exact = options.filter(
    (concert) => normalizeConcertName(concert.name) === query,
  )
  if (exact.length > 1) {
    return {
      status: 'ambiguous',
      candidates: exact.map((concert) => ({ name: concert.name })),
    }
  }
  if (exact.length === 1) {
    const selected = exact[0]
    if (!selected) return { status: 'not_found' }
    const concert = await getConcertOverview(db, selected.id)
    return concert ? { status: 'ok', concert } : { status: 'not_found' }
  }

  const partial = options.filter((concert) =>
    normalizeConcertName(concert.name).includes(query),
  )
  if (partial.length > 1) {
    return {
      status: 'ambiguous',
      candidates: partial.map((concert) => ({ name: concert.name })),
    }
  }
  if (partial.length === 1) {
    const selected = partial[0]
    if (!selected) return { status: 'not_found' }
    const concert = await getConcertOverview(db, selected.id)
    return concert ? { status: 'ok', concert } : { status: 'not_found' }
  }

  return { status: 'not_found' }
}

type Collected = {
  items: Array<SearchItem>
  sources: Array<SourceLink>
}

async function collectItems(
  db: Db,
  concert: ConcertOverview,
  input: SearchPortalInput,
): Promise<Collected> {
  const collected: Collected = { items: [], sources: [] }
  const topics = new Set(input.topics)
  const needsPractices = topics.has('practices') || topics.has('recordings')
  const practices = needsPractices
    ? await listPracticesWithMedia(db, concert.id)
    : []

  if (topics.has('concert')) {
    pushConcert(collected, concert)
  }
  if (topics.has('practices')) {
    pushPractices(collected, concert.id, practices, input)
  }
  if (topics.has('recordings')) {
    pushRecordings(collected, practices, input)
  }
  if (topics.has('announcements')) {
    const announcements = await listAnnouncementsForConcert(db, concert.id)
    for (const announcement of announcements) {
      const key = `announcement:${announcement.id}`
      collected.items.push({
        key,
        topic: 'announcements',
        title: announcement.title,
        summary: announcement.body,
      })
      if (announcement.url && isHttpUrl(announcement.url)) {
        collected.sources.push({
          key,
          label: announcement.title,
          href: announcement.url,
          external: true,
        })
      } else {
        collected.sources.push(
          internalLink(key, announcement.title, '/', concert.id),
        )
      }
    }
  }
  if (topics.has('resources')) {
    const resources = await listConcertResources(db, concert.id)
    for (const resource of resources) {
      if (!isHttpUrl(resource.url)) continue
      const key = `resource:${resource.id}`
      collected.items.push({
        key,
        topic: 'resources',
        title: resource.title,
        summary: '演奏会資料が登録されています',
      })
      collected.sources.push({
        key,
        label: resource.title,
        href: resource.url,
        external: true,
      })
    }
  }
  if (topics.has('pieces')) {
    const pieces = await listPiecesForConcert(db, concert.id)
    for (const piece of pieces) {
      const key = `piece:${piece.id}`
      const flags: Array<string> = []
      if (piece.bowingUrl) flags.push('ボウイングありの楽譜あり')
      if (piece.scoreWithoutBowingUrl) flags.push('ボウイングなしの楽譜あり')
      collected.items.push({
        key,
        topic: 'pieces',
        title: piece.composer
          ? `${piece.title}（${piece.composer}）`
          : piece.title,
        summary: flags.length > 0 ? flags.join('。') : '楽譜リンクは未登録',
      })
      collected.sources.push(
        internalLink(key, piece.title, '/pieces', concert.id),
      )
      if (piece.bowingUrl && isHttpUrl(piece.bowingUrl)) {
        const bowingKey = `piece-bowing:${piece.id}`
        collected.items.push({
          key: bowingKey,
          topic: 'pieces',
          title: `${piece.title}のボウイングあり楽譜`,
          summary: 'ボウイングありの楽譜が登録されています',
        })
        collected.sources.push({
          key: bowingKey,
          label: `${piece.title}（ボウイングあり）`,
          href: piece.bowingUrl,
          external: true,
        })
      }
      if (
        piece.scoreWithoutBowingUrl &&
        isHttpUrl(piece.scoreWithoutBowingUrl)
      ) {
        const scoreKey = `piece-score:${piece.id}`
        collected.items.push({
          key: scoreKey,
          topic: 'pieces',
          title: `${piece.title}のボウイングなし楽譜`,
          summary: 'ボウイングなしの楽譜が登録されています',
        })
        collected.sources.push({
          key: scoreKey,
          label: `${piece.title}（ボウイングなし）`,
          href: piece.scoreWithoutBowingUrl,
          external: true,
        })
      }
    }
  }

  return filterCollected(collected, input.keywords)
}

function pushConcert(collected: Collected, concert: ConcertOverview) {
  const key = `concert:${concert.id}`
  const parts = [
    concert.performanceDate
      ? `本番日 ${concert.performanceDate}`
      : '本番日は未登録',
    concert.venueName
      ? `会場 ${concert.venueName}${concert.venueAddress ? `（${concert.venueAddress}）` : ''}`
      : '会場は未登録',
    concert.attendanceUrl
      ? '出欠の回答先が登録されています'
      : '出欠の回答先は未登録',
    concert.attendanceNote ? `出欠メモ: ${concert.attendanceNote}` : null,
    concert.note ? `備考: ${concert.note}` : null,
  ].filter((part): part is string => part !== null)

  collected.items.push({
    key,
    topic: 'concert',
    title: concert.name,
    summary: parts.join('。'),
  })
  collected.sources.push(internalLink(key, concert.name, '/', concert.id))

  if (concert.attendanceUrl && isHttpUrl(concert.attendanceUrl)) {
    const attendanceKey = `attendance:${concert.id}`
    collected.items.push({
      key: attendanceKey,
      topic: 'concert',
      title: `${concert.name}の出欠回答先`,
      summary: '出欠の回答先が登録されています',
    })
    collected.sources.push({
      key: attendanceKey,
      label: '出欠を回答する',
      href: concert.attendanceUrl,
      external: true,
    })
  }
}

function pushPractices(
  collected: Collected,
  concertId: number,
  practices: ReadonlyArray<PracticeEntry>,
  input: SearchPortalInput,
) {
  for (const practice of practices) {
    if (!inDateRange(practice.date, input.dateFrom, input.dateTo)) continue
    const key = `practice:${practice.id}`
    const time = [practice.startTime, practice.endTime]
      .filter((value): value is string => value !== null)
      .join('〜')
    const parts = [
      practice.date,
      time || null,
      practice.venue ? `会場 ${practice.venue.name}` : '会場未設定',
      practice.detail ? `詳細: ${practice.detail}` : null,
    ].filter((part): part is string => part !== null)

    collected.items.push({
      key,
      topic: 'practices',
      title: `${practice.date}の練習`,
      summary: parts.join('。'),
    })
    collected.sources.push(
      internalLink(key, `${practice.date}の練習`, '/practices', concertId),
    )
  }
}

function pushRecordings(
  collected: Collected,
  practices: ReadonlyArray<PracticeEntry>,
  input: SearchPortalInput,
) {
  for (const practice of practices) {
    if (!inDateRange(practice.date, input.dateFrom, input.dateTo)) continue
    for (const media of practice.media) {
      if (!isHttpUrl(media.url)) continue
      const key = `recording:${media.id}`
      collected.items.push({
        key,
        topic: 'recordings',
        title: media.title,
        summary: `${practice.date}の練習の録音・録画`,
      })
      collected.sources.push({
        key,
        label: media.title,
        href: media.url,
        external: true,
      })
    }
  }
}

function filterCollected(
  collected: Collected,
  keywords: string | undefined,
): Collected {
  const needle = keywords === undefined ? '' : normalizeConcertName(keywords)
  if (needle === '') return collected

  const items = collected.items.filter((item) =>
    normalizeConcertName(`${item.title} ${item.summary}`).includes(needle),
  )
  const keys = new Set(items.map((item) => item.key))
  return {
    items,
    sources: collected.sources.filter((source) => keys.has(source.key)),
  }
}

function limitResult(
  concertName: string,
  collected: Collected,
): SearchPortalExecution {
  const itemCap = ASSISTANT_LIMITS.searchItemsMax
  let items = collected.items.slice(0, itemCap)
  let truncated = collected.items.length > itemCap
  let sources = sourcesFor(collected.sources, items)

  const pack = (nextItems: Array<SearchItem>) => ({
    status: 'ok' as const,
    concertName,
    candidates: [],
    items: nextItems,
    truncated,
  })

  let forModel = pack(items)
  while (
    JSON.stringify(forModel).length > ASSISTANT_LIMITS.searchCharsMax &&
    items.length > 0
  ) {
    items = items.slice(0, -1)
    truncated = true
    sources = sourcesFor(collected.sources, items)
    forModel = pack(items)
  }

  return { forModel, sources }
}

function sourcesFor(
  sources: ReadonlyArray<SourceLink>,
  items: ReadonlyArray<SearchItem>,
): Array<SourceLink> {
  const keys = new Set(items.map((item) => item.key))
  return sources.filter((source) => keys.has(source.key))
}

function inDateRange(
  date: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): boolean {
  if (dateFrom !== undefined && date < dateFrom) return false
  if (dateTo !== undefined && date > dateTo) return false
  return true
}

function internalLink(
  key: string,
  label: string,
  path: '/' | '/practices' | '/pieces',
  concertId: number,
): SourceLink {
  return {
    key,
    label,
    href: `${path}?concert=${concertId}`,
    external: false,
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
