import { Button, Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { ExternalLink } from '../../components/external-link'
import { EmptyState, NoConcertState } from '../../components/states'
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

/** ホームだけパンフレット型。他タブのコンパクト表現とは分ける */
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
    <div className="pamphlet">
      {nextPractice ? (
        <NextPracticeProgram
          practice={nextPractice}
          concertName={concert.name}
        />
      ) : (
        <EmptyState
          title="今後の練習の予定はありません"
          description="終わった練習は日程一覧から見られます。"
        />
      )}

      <section className="pamphlet-section" aria-labelledby="performance-title">
        <p className="pamphlet-kicker">本番</p>
        <Title order={2} id="performance-title" className="pamphlet-heading">
          {concert.name}
        </Title>
        <Text size="sm" c="dimmed" mt={6}>
          {concert.performanceDate
            ? formatFullDate(concert.performanceDate)
            : '本番日は未設定'}
          {concert.venueName && (
            <>
              <br />
              {concert.venueName}
            </>
          )}
        </Text>
        <div className="pamphlet-links">
          {concert.venueAddress && (
            <ExternalLink href={buildGoogleMapsUrl(concert.venueAddress)}>
              Google Mapsで開く
            </ExternalLink>
          )}
          {performanceCalendarUrl && (
            <ExternalLink href={performanceCalendarUrl}>
              カレンダーに追加
            </ExternalLink>
          )}
        </div>
      </section>

      <section className="pamphlet-section" aria-labelledby="attendance-title">
        <p className="pamphlet-kicker" id="attendance-title">
          出欠の回答
        </p>
        {concert.attendanceUrl ? (
          <Stack gap="sm" align="center">
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
      </section>

      {concert.note && (
        <section className="pamphlet-section" aria-labelledby="note-title">
          <p className="pamphlet-kicker" id="note-title">
            備考
          </p>
          <p className="detail pamphlet-note">{concert.note}</p>
        </section>
      )}

      {resources.length > 0 && (
        <section className="pamphlet-section" aria-label="資料">
          <p className="pamphlet-kicker">資料</p>
          <Stack gap="xs" component="ul" p={0} style={{ listStyle: 'none' }}>
            {resources.map((resource) => (
              <li key={resource.id}>
                <ExternalLink href={resource.url}>
                  {resource.title}
                </ExternalLink>
              </li>
            ))}
          </Stack>
        </section>
      )}

      {appSettings.adminEmail && (
        <section className="pamphlet-section" aria-labelledby="inquiry-title">
          <p className="pamphlet-kicker" id="inquiry-title">
            問い合わせ
          </p>
          <Button
            component="a"
            href={buildInquiryMailtoUrl(appSettings.adminEmail, concert.name)}
            fullWidth
            maw="20rem"
            mx="auto"
            display="block"
          >
            管理者へ問い合わせる
          </Button>
        </section>
      )}
    </div>
  )
}

type NextPracticeProgramProps = {
  practice: PracticeEntry
  concertName: string
}

function NextPracticeProgram({
  practice,
  concertName,
}: NextPracticeProgramProps) {
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
    <section className="pamphlet-hero" aria-labelledby="next-practice-title">
      <p className="pamphlet-kicker" id="next-practice-title">
        次の練習
      </p>
      {parts ? (
        <>
          <p className="pamphlet-date">
            {parts.month}月{parts.day}日
          </p>
          <p className="pamphlet-weekday">{parts.weekday}曜日</p>
        </>
      ) : (
        <p className="pamphlet-date">{formatDate(practice.date)}</p>
      )}
      {time && <p className="pamphlet-time">{time}</p>}
      {practice.venue ? (
        <p className="pamphlet-venue">
          {practice.venue.name}
          <br />
          <Text span size="sm" c="dimmed">
            {practice.venue.address}
          </Text>
          {practice.venue.note && (
            <>
              <br />
              <Text span size="sm" c="dimmed">
                {practice.venue.note}
              </Text>
            </>
          )}
        </p>
      ) : (
        <p className="pamphlet-venue">
          <Text span c="dimmed">
            会場は未定です。
          </Text>
        </p>
      )}
      <div className="pamphlet-links">
        {mapsUrl && <ExternalLink href={mapsUrl}>Google Maps</ExternalLink>}
        {calendarUrl && (
          <ExternalLink href={calendarUrl}>カレンダーに追加</ExternalLink>
        )}
      </div>
      {practice.detail && (
        <details className="pamphlet-details">
          <summary>詳細</summary>
          <p className="detail">{practice.detail}</p>
        </details>
      )}
      {practice.media.length > 0 && (
        <Stack gap={4} mt="sm">
          <Text size="sm" c="dimmed">
            録音・録画
          </Text>
          <Stack gap={2} component="ul" pl="md" style={{ margin: 0 }}>
            {practice.media.map((link) => (
              <li key={link.id}>
                <ExternalLink href={link.url}>{link.title}</ExternalLink>
              </li>
            ))}
          </Stack>
        </Stack>
      )}
    </section>
  )
}
