import { type CurrentSession, getCurrentSession } from './functions'

/**
 * `beforeLoad` は画面遷移のたびに走るため、そのつど問い合わせると D1 の
 * 読み取りが遷移回数ぶん増える。セッションが変わるのはログインとログアウトの
 * ときだけなので、そこで捨てれば足りる。
 *
 * これは体験を軽くするためのもので、認可の判断ではない。実体はサーバ関数の
 * middleware 側にある（設計書8.4）。
 */
let pending: Promise<CurrentSession | null> | null = null

export function loadCurrentSession(): Promise<CurrentSession | null> {
  pending ??= getCurrentSession().catch((error: unknown) => {
    pending = null
    throw error
  })
  return pending
}

export function forgetCurrentSession(): void {
  pending = null
}
