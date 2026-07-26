import { listConcerts } from './functions'
import type { ConcertOption } from './queries'

/**
 * 演奏会の一覧は `_authed` の `beforeLoad` が選択を解決するのに使う。`beforeLoad` は
 * 画面遷移のたびに走るので、セッションと同じ理由（ADR-0005）で1回だけ取得して使い回す。
 *
 * 一覧が変わるのは管理画面での作成・編集・削除のときだけなので、そこで捨てれば足りる。
 */
let pending: Promise<Array<ConcertOption>> | null = null

export function loadConcerts(): Promise<Array<ConcertOption>> {
  pending ??= listConcerts().catch((error: unknown) => {
    pending = null
    throw error
  })
  return pending
}

export function forgetConcerts(): void {
  pending = null
}
