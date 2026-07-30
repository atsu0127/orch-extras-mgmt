import { Group, Stack, Text } from '@mantine/core'
import { departureDateParts, formatDate, formatTimeRange } from '../lib/date'
import {
  buildGoogleMapsUrl,
  buildPracticeCalendarUrl,
} from '../lib/external-urls'
import type { PracticeEntry } from '../practices/queries'
import { ExternalLink } from './external-link'

type PracticeItemProps = {
  practice: PracticeEntry
  concertName: string
}

/** 練習1件。ダッシュボード要約バーと揃えたコンパクトな日付列 */
export function PracticeItem({ practice, concertName }: PracticeItemProps) {
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
    <article className="practice-row">
      <div className="practice-row-date">
        {parts ? (
          <>
            <div className="practice-row-month">{parts.month}月</div>
            <div className="practice-row-day">{parts.day}</div>
            <div className="practice-row-weekday">{parts.weekday}</div>
          </>
        ) : (
          <Text fw={700} size="sm">
            {formatDate(practice.date)}
          </Text>
        )}
      </div>

      <Stack gap={4}>
        {time && (
          <Text fw={700} size="sm">
            {time}
          </Text>
        )}

        {practice.venue ? (
          <Text size="sm" c="dimmed">
            {practice.venue.name}
            <br />
            {practice.venue.address}
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

        <Group gap="md">
          {practice.venue && (
            <ExternalLink href={buildGoogleMapsUrl(practice.venue.address)}>
              地図を開く
            </ExternalLink>
          )}
          {calendarUrl && (
            <ExternalLink href={calendarUrl}>予定に追加</ExternalLink>
          )}
        </Group>

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
    </article>
  )
}

export function OrderBadge({ value }: { value: number }) {
  return (
    <span
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        minWidth: '1.75rem',
        height: '1.75rem',
        padding: '0 0.4rem',
        borderRadius: '6px',
        background:
          'color-mix(in srgb, var(--mantine-color-bordeaux-filled) 12%, transparent)',
        color: 'var(--mantine-color-bordeaux-filled)',
        fontSize: '0.8125rem',
        fontWeight: 700,
      }}
    >
      {value}
    </span>
  )
}
