import { formatDate, formatTimeRange } from '../lib/date'
import type { PracticeEntry } from '../practices/queries'
import { ExternalLink } from './external-link'

/** 練習1件の見せ方。ダッシュボードの「次の練習」と日程一覧で同じものを使う */
export function PracticeItem({ practice }: { practice: PracticeEntry }) {
  const time = formatTimeRange(practice.startTime, practice.endTime)

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
