import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export type Db = ReturnType<typeof getDb>

/**
 * D1 の binding は呼び出し時に読む。モジュール読み込み時に読むと
 * クライアントバンドルへ混入する恐れがある（設計書8.5）。
 */
export function getDb() {
  return drizzle(env.DB, { schema })
}
