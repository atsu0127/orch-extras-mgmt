import { Badge, Stack, Text } from '@mantine/core'
import { formatDate, formatTimeRange } from '../lib/date'
import {
  buildGoogleMapsUrl,
  buildPracticeCalendarUrl,
} from '../lib/external-urls'
import type { PracticeEntry } from '../practices/queries'
import { ExternalLink } from './external-link'
import { ListItem } from './list-item'

type PracticeItemProps = {
  practice: PracticeEntry
  concertName: string
}

/** 練習1件の見せ方。ダッシュボードの「次の練習」と日程一覧で同じものを使う */
export function PracticeItem({ practice, concertName }: PracticeItemProps) {
  const time = formatTimeRange(practice.startTime, practice.endTime)
  const calendarUrl = buildPracticeCalendarUrl({
    concertName,
    date: practice.date,
    startTime: practice.startTime,
    endTime: practice.endTime,
    venue: practice.venue,
  })

  return (
    <ListItem>
      <Stack gap={4}>
        <Text fw={600} size="lg">
          {formatDate(practice.date)}
          {time && (
            <Text span size="sm" c="dimmed" ml="sm">
              {time}
            </Text>
          )}
        </Text>

        {practice.venue ? (
          <Text size="sm" c="dimmed">
            {practice.venue.name}
            <br />
            {practice.venue.address}
            <br />
            <ExternalLink href={buildGoogleMapsUrl(practice.venue.address)}>
              Google Mapsで開く
            </ExternalLink>
            {practice.venue.note && (
              <>
                <br />
                {practice.venue.note}
              </>
            )}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            会場は未定です。
          </Text>
        )}

        {calendarUrl && (
          <Text size="sm">
            <ExternalLink href={calendarUrl}>
              Googleカレンダーに追加
            </ExternalLink>
          </Text>
        )}

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
    </ListItem>
  )
}

export function OrderBadge({ value }: { value: number }) {
  return (
    <Badge color="bordeaux" variant="light" radius="sm" size="lg">
      {value}
    </Badge>
  )
}
