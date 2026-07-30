import { formatDate, formatTimeRange } from '../lib/date'
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
    <div className="item">
      <div className="item-title">
        <span>{formatDate(practice.date)}</span>
        {time && <span className="item-note">{time}</span>}
      </div>

      {practice.venue ? (
        <p className="item-note">
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
        </p>
      ) : (
        <p className="item-note">会場は未定です。</p>
      )}

      {calendarUrl && (
        <p>
          <ExternalLink href={calendarUrl}>Googleカレンダーに追加</ExternalLink>
        </p>
      )}

      {practice.detail && (
        <details>
          <summary>詳細</summary>
          <p className="detail">{practice.detail}</p>
        </details>
      )}

      {practice.media.length > 0 && (
        <div>
          <p className="item-note">録音・録画</p>
          <ul className="link-list">
            {practice.media.map((link) => (
              <li key={link.id}>
                <ExternalLink href={link.url}>{link.title}</ExternalLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
