/**
 * E2E / `db:seed --reset` が共有する固定ラベル。
 * 断言と投入データを同じ定数から組み立て、文言ずれで落ちないようにする。
 */
export const E2E_FIXTURE = {
  venueName: '市民会館 大練習室',
  venueAddress: '東京都千代田区1-2-3',
  venueNote: '駅から徒歩10分',
  concertName: '第10回定期演奏会',
  attendanceUrl: 'https://example.com/attendance',
  attendanceNote: '本番1か月前までに回答してください',
  concertNote: '本番前に楽譜を持参してください',
  resourceTitle: '演奏会のしおり',
  resourceUrl: 'https://example.com/resources/pamphlet',
  adminEmail: 'admin@example.com',
  pastPracticeDetail: '前半に1・2楽章、後半に通し',
  upcomingPracticeDetail: '弦分奏',
  recordingTitle: '1楽章 通し',
  recordingUrl: 'https://example.com/recordings/1',
  pieceWithBowing: '交響曲第5番',
  pieceWithBowingComposer: 'ベートーヴェン',
  pieceWithBowingUrl: 'https://example.com/bowing/1',
  pieceWithoutBowing: 'フィンランディア',
  pieceWithoutBowingComposer: 'シベリウス',
  announcementTitle: 'ボウイングを更新しました',
  announcementBody:
    '弦パートのボウイングを差し替えました。練習前に確認してください。',
  announcementUrl: 'https://example.com/bowing/1',
  olderAnnouncementTitle: '練習会場の案内',
  olderAnnouncementBody: '次回は市民会館の大練習室です。',
} as const
