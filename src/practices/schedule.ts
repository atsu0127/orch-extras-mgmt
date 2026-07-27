export const PRACTICE_VIEWS = ['upcoming', 'past'] as const

export type PracticeView = (typeof PRACTICE_VIEWS)[number]

type Schedulable = {
  date: string
  startTime: string | null
}

/**
 * 日本時間の今日を境に分ける（設計書5.4）。今日の練習はまだ終わっていないので「今後」に入れる。
 *
 * 今後は早い順、過去は新しい順にする。過去は直近の練習の録音を探すことが多いため、
 * 一覧の先頭に来ている方が探しやすい。
 */
export function splitPractices<T extends Schedulable>(
  practices: ReadonlyArray<T>,
  today: string,
): { upcoming: Array<T>; past: Array<T> } {
  return {
    upcoming: practices.filter(({ date }) => date >= today).sort(byStart),
    past: practices
      .filter(({ date }) => date < today)
      .sort((a, b) => byStart(b, a)),
  }
}

/** 日付・時刻は日本時間の文字列なので、辞書順がそのまま時系列になる */
function byStart(a: Schedulable, b: Schedulable): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.startTime ?? '').localeCompare(b.startTime ?? '')
  )
}
