import { Button, Stack, Text, Title } from '@mantine/core'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../auth/middleware'
import { ExternalLink } from '../../components/external-link'
import { PracticeItem } from '../../components/practice-item'
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
import { formatFullDate, todayInJst } from '../../lib/date'
import {
  buildGoogleMapsUrl,
  buildInquiryMailtoUrl,
  buildPerformanceCalendarUrl,
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
      <Stack gap="xs" component="section">
        <Title order={1}>{concert.name}</Title>
        {concert.performanceDate && (
          <Text c="dimmed">
            本番 {formatFullDate(concert.performanceDate)}
            {concert.venueName && ` / ${concert.venueName}`}
          </Text>
        )}
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
      </Stack>

      <PageSection title="次の練習">
        {nextPractice ? (
          <PracticeItem practice={nextPractice} concertName={concert.name} />
        ) : (
          <EmptyState
            title="今後の練習の予定はありません"
            description="終わった練習は日程一覧から見られます。"
          />
        )}
      </PageSection>

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

      <PageSection title="出欠の回答">
        {concert.attendanceUrl ? (
          <Stack gap="sm">
            <ExternalLink href={concert.attendanceUrl} action>
              出欠を回答する
            </ExternalLink>
            {concert.attendanceNote && <Text>{concert.attendanceNote}</Text>}
          </Stack>
        ) : (
          <EmptyState
            title="出欠の回答先はまだ設定されていません"
            description="決まり次第ここに表示されます。"
          />
        )}
      </PageSection>

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

      <Stack gap="sm" component="nav" aria-label="関連ページ">
        <Button component={Link} to="/practices" variant="light" fullWidth>
          練習日程をすべて見る
        </Button>
        <Button component={Link} to="/pieces" variant="light" fullWidth>
          曲とボウイングを見る
        </Button>
      </Stack>
    </>
  )
}
