import { Button, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'
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
        <NextPracticeBoard practice={nextPractice} concertName={concert.name} />
      ) : (
        <EmptyState
          title="今後の練習の予定はありません"
          description="終わった練習は日程一覧から見られます。"
        />
      )}

      <Stack gap={4} component="section" className="section-rule">
        <Text className="departure-kicker">本番</Text>
        <Title order={2}>{concert.name}</Title>
        <Text size="sm" c="dimmed">
          {concert.performanceDate
            ? formatFullDate(concert.performanceDate)
            : '本番日は未設定'}
          {concert.venueName && ` / ${concert.venueName}`}
        </Text>
        <Group gap="md" mt={4}>
          {concert.venueAddress && (
            <ExternalLink href={buildGoogleMapsUrl(concert.venueAddress)}>
              Google Mapsで開く
            </ExternalLink>
          )}
          {performanceCalendarUrl && (
            <ExternalLink href={performanceCalendarUrl}>
              Googleカレンダーに追加
            </ExternalLink>
          )}
        </Group>
      </Stack>

      <Stack gap="xs" component="section" className="section-rule">
        <Text className="departure-kicker">出欠の回答</Text>
        {concert.attendanceUrl ? (
          <>
            <ExternalLink href={concert.attendanceUrl} action>
              出欠を回答する
            </ExternalLink>
            {concert.attendanceNote && (
              <Text size="sm" c="dimmed" ta="center">
                {concert.attendanceNote}
              </Text>
            )}
          </>
        ) : (
          <EmptyState
            title="出欠の回答先はまだ設定されていません"
            description="決まり次第ここに表示されます。"
          />
        )}
      </Stack>

      {concert.note && (
        <PageSection title="備考">
          <p className="detail">{concert.note}</p>
        </PageSection>
      )}

      {resources.length > 0 && (
        <PageSection title="資料">
          <Stack gap={4} component="ul" pl="md" style={{ margin: 0 }}>
            {resources.map((resource) => (
              <li key={resource.id}>
                <ExternalLink href={resource.url}>
                  {resource.title}
                </ExternalLink>
              </li>
            ))}
          </Stack>
        </PageSection>
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

type NextPracticeBoardProps = {
  practice: PracticeEntry
  concertName: string
}

/** 出発案内型の「次の練習」。日付を大きく分け、操作導線をその中に閉じる */
function NextPracticeBoard({ practice, concertName }: NextPracticeBoardProps) {
  const parts = departureDateParts(practice.date)
  const time = formatTimeRange(practice.startTime, practice.endTime)
  const calendarUrl = buildPracticeCalendarUrl({
    concertName,
    date: practice.date,
    startTime: practice.startTime,
    endTime: practice.endTime,
    venue: practice.venue,
  })

  return (
    <section className="departure-board" aria-labelledby="next-practice-title">
      <div className="departure-date">
        {parts ? (
          <>
            <div className="departure-month">{parts.month}月</div>
            <div className="departure-day">{parts.day}</div>
            <div className="departure-weekday">{parts.weekday}曜日</div>
          </>
        ) : (
          <Text fw={700}>{formatDate(practice.date)}</Text>
        )}
      </div>

      <Stack gap="xs">
        <Text className="departure-kicker" id="next-practice-title">
          次の練習
        </Text>
        {time && (
          <Text fw={600} size="lg">
            {time}
          </Text>
        )}

        {practice.venue ? (
          <Text size="sm">
            <Text span fw={600}>
              {practice.venue.name}
            </Text>
            <br />
            {practice.venue.address}
            {practice.venue.note && (
              <>
                <br />
                <Text span c="dimmed">
                  {practice.venue.note}
                </Text>
              </>
            )}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            会場は未定です。
          </Text>
        )}

        <SimpleGrid cols={2} spacing="sm" mt={4}>
          {practice.venue && (
            <Button
              component="a"
              href={buildGoogleMapsUrl(practice.venue.address)}
              target="_blank"
              rel="noopener noreferrer"
              variant="default"
              fullWidth
            >
              地図を開く
            </Button>
          )}
          {calendarUrl && (
            <Button
              component="a"
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="default"
              fullWidth
            >
              予定に追加
            </Button>
          )}
        </SimpleGrid>

        {practice.detail && (
          <details>
            <summary>詳細</summary>
            <p className="detail">{practice.detail}</p>
          </details>
        )}

        {practice.media.length > 0 && (
          <Stack gap={4}>
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
      </Stack>
    </section>
  )
}
