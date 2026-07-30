import { Button, Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { ExternalLink } from '../../components/external-link'
import {
  EmptyState,
  NoConcertState,
  PageSection,
} from '../../components/states'
import { listConcertResources } from '../../concert-resources/queries'
import {
  type ConcertOverview,
  getConcertOverview,
} from '../../concerts/queries'
import { getDb } from '../../db/client'
import {
  departureDateParts,
  formatDate,
  formatFullDate,
  formatTimeRange,
  todayInJst,
} from '../../lib/date'
import {
  buildGoogleMapsUrl,
  buildInquiryMailtoUrl,
  buildPerformanceCalendarUrl,
  buildPracticeCalendarUrl,
} from '../../lib/external-urls'
import { getNextPractice, type PracticeEntry } from '../../practices/queries'
import { type AppSettingsView, getAppSettings } from '../../settings/queries'

const getDashboard = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .validator(z.object({ concertId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [concert, nextPractice, appSettings, resources] = await Promise.all([
      getConcertOverview(db, data.concertId),
      getNextPractice(db, data.concertId, todayInJst()),
      getAppSettings(db),
      listConcertResources(db, data.concertId),
    ])

    return { concert, nextPractice, appSettings, resources }
  })

export const Route = createFileRoute('/_authed/')({
  loaderDeps: ({ search }) => ({ concert: search.concert }),
  loader: ({ deps }) =>
    deps.concert === undefined
      ? null
      : getDashboard({ data: { concertId: deps.concert } }),
  component: Dashboard,
})

function Dashboard() {
  const { session } = Route.useRouteContext()
  const data = Route.useLoaderData()
  if (!data?.concert) return <NoConcertState role={session.role} />

  return <DashboardContent {...data} concert={data.concert} />
}

type DashboardContentProps = {
  concert: ConcertOverview
  nextPractice: PracticeEntry | null
  appSettings: AppSettingsView
  resources: Array<{
    id: number
    title: string
    url: string
  }>
}

export function DashboardContent({
  concert,
  nextPractice,
  appSettings,
  resources,
}: DashboardContentProps) {
  const performanceCalendarUrl = concert.performanceDate
    ? buildPerformanceCalendarUrl({
        concertName: concert.name,
        date: concert.performanceDate,
        venue:
          concert.venueName && concert.venueAddress
            ? { name: concert.venueName, address: concert.venueAddress }
            : null,
      })
    : null

  return (
    <>
      {nextPractice ? (
        <NextPracticeStrip practice={nextPractice} concertName={concert.name} />
      ) : (
        <EmptyState
          title="今後の練習の予定はありません"
          description="終わった練習は日程一覧から見られます。"
        />
      )}

      {nextPractice && (
        <NextPracticeExtras
          practice={nextPractice}
          concertName={concert.name}
        />
      )}

      <section className="panel" aria-labelledby="performance-title">
        <div className="panel-head">本番</div>
        <div className="panel-body">
          <Title order={2} id="performance-title">
            {concert.name}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {concert.performanceDate
              ? formatFullDate(concert.performanceDate)
              : '本番日は未設定'}
            {concert.venueName && ` / ${concert.venueName}`}
          </Text>
        </div>
        {concert.venueAddress && (
          <a
            className="panel-row"
            href={buildGoogleMapsUrl(concert.venueAddress)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Google Mapsで開く</span>
            <span className="panel-row-chevron" aria-hidden>
              ›
            </span>
          </a>
        )}
        {performanceCalendarUrl && (
          <a
            className="panel-row"
            href={performanceCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>カレンダーに追加</span>
            <span className="panel-row-chevron" aria-hidden>
              ›
            </span>
          </a>
        )}
      </section>

      <section className="panel" aria-labelledby="attendance-title">
        <div className="panel-head" id="attendance-title">
          出欠の回答
        </div>
        <div className="panel-body">
          {concert.attendanceUrl ? (
            <Stack gap="xs">
              <ExternalLink href={concert.attendanceUrl} action>
                出欠を回答する
              </ExternalLink>
              {concert.attendanceNote && (
                <Text size="sm" c="dimmed">
                  {concert.attendanceNote}
                </Text>
              )}
            </Stack>
          ) : (
            <EmptyState
              title="出欠の回答先はまだ設定されていません"
              description="決まり次第ここに表示されます。"
            />
          )}
        </div>
      </section>

      {concert.note && (
        <section className="panel">
          <div className="panel-head">備考</div>
          <div className="panel-body">
            <p className="detail">{concert.note}</p>
          </div>
        </section>
      )}

      {resources.length > 0 && (
        <section className="panel" aria-label="資料">
          <div className="panel-head">資料</div>
          {resources.map((resource) => (
            <a
              key={resource.id}
              className="panel-row"
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{resource.title}</span>
              <span className="panel-row-chevron" aria-hidden>
                ›
              </span>
            </a>
          ))}
        </section>
      )}

      {appSettings.adminEmail && (
        <PageSection title="問い合わせ">
          <Button
            component="a"
            href={buildInquiryMailtoUrl(appSettings.adminEmail, concert.name)}
            fullWidth
          >
            管理者へ問い合わせる
          </Button>
        </PageSection>
      )}
    </>
  )
}

type NextPracticeStripProps = {
  practice: PracticeEntry
  concertName: string
}

/** 実用コンパクトの「次の練習」要約バー */
function NextPracticeStrip({ practice, concertName }: NextPracticeStripProps) {
  const parts = departureDateParts(practice.date)
  const time = formatTimeRange(practice.startTime, practice.endTime)
  const mapsUrl = practice.venue
    ? buildGoogleMapsUrl(practice.venue.address)
    : null
  const calendarUrl = buildPracticeCalendarUrl({
    concertName,
    date: practice.date,
    startTime: practice.startTime,
    endTime: practice.endTime,
    venue: practice.venue,
  })

  return (
    <section className="next-strip" aria-labelledby="next-practice-title">
      <div className="next-strip-date">
        {parts ? (
          <>
            <div className="next-strip-month">{parts.month}月</div>
            <div className="next-strip-day">{parts.day}</div>
          </>
        ) : (
          <Text fw={700} c="inherit" size="sm">
            {formatDate(practice.date)}
          </Text>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="next-strip-kicker" id="next-practice-title">
          次の練習
          {parts ? ` · ${parts.weekday}` : ''}
        </div>
        {time && <div className="next-strip-time">{time}</div>}
        <div className="next-strip-venue">
          {practice.venue?.name ?? '会場は未定です'}
        </div>
      </div>

      {mapsUrl ? (
        <a
          className="next-strip-action"
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          地図
        </a>
      ) : calendarUrl ? (
        <a
          className="next-strip-action"
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          予定
        </a>
      ) : (
        <span />
      )}
    </section>
  )
}

function NextPracticeExtras({
  practice,
  concertName,
}: {
  practice: PracticeEntry
  concertName: string
}) {
  const calendarUrl = buildPracticeCalendarUrl({
    concertName,
    date: practice.date,
    startTime: practice.startTime,
    endTime: practice.endTime,
    venue: practice.venue,
  })

  const showCalendar = Boolean(calendarUrl)
  const showDetail = Boolean(practice.detail)
  const showMedia = practice.media.length > 0
  const showVenueMeta = Boolean(practice.venue?.address || practice.venue?.note)
  if (!showCalendar && !showDetail && !showMedia && !showVenueMeta) {
    return null
  }

  return (
    <section className="panel" aria-label="次の練習の詳細">
      {showVenueMeta && practice.venue && (
        <div className="panel-body">
          <Text size="sm" c="dimmed">
            {practice.venue.address}
            {practice.venue.note && (
              <>
                <br />
                {practice.venue.note}
              </>
            )}
          </Text>
        </div>
      )}
      {showCalendar && calendarUrl && (
        <a
          className="panel-row"
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>カレンダーに追加</span>
          <span className="panel-row-chevron" aria-hidden>
            ›
          </span>
        </a>
      )}
      {showDetail && (
        <div className="panel-body">
          <details>
            <summary>詳細</summary>
            <p className="detail">{practice.detail}</p>
          </details>
        </div>
      )}
      {showMedia && (
        <div className="panel-body">
          <Text size="sm" c="dimmed" mb={4}>
            録音・録画
          </Text>
          <Stack gap={2} component="ul" pl="md" style={{ margin: 0 }}>
            {practice.media.map((link) => (
              <li key={link.id}>
                <ExternalLink href={link.url}>{link.title}</ExternalLink>
              </li>
            ))}
          </Stack>
        </div>
      )}
    </section>
  )
}
