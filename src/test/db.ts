import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type { Db } from '../db/client'
import * as schema from '../db/schema'

const migrationsDir = fileURLToPath(
  new URL('../../migrations', import.meta.url),
)

/** 全テーブルが text と integer だけなので、束縛される値もこの範囲に収まる */
type BoundValue = string | number | bigint | null

/**
 * 単体テスト用のインメモリ DB。期限切れの除外やレート制限の集計は SQL 側で
 * 行うため、偽のリポジトリではなく本物の SQLite に対して検証する。
 *
 * D1 と sqlite-proxy はドライバが違うだけでクエリビルダの形は同じなので、
 * `Db` として扱う。両者で挙動が分かれる `batch` はテストで使わない。
 */
export function createTestDb(): Db {
  const sqlite = new DatabaseSync(':memory:')
  const migrations = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of migrations) {
    sqlite.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }

  const db = drizzle(
    async (sql, params, method) => {
      const statement = sqlite.prepare(sql)
      // drizzle は列名ではなく列順で結果を読む。node:sqlite の型定義は
      // setReturnArrays の効果を表現しないため、戻り値は自分で組み直す
      statement.setReturnArrays(true)
      const values = params as Array<BoundValue>

      if (method === 'run') {
        statement.run(...values)
        return { rows: [] }
      }
      if (method === 'get') {
        // drizzle は「行が無い」ことを rows が falsy かどうかで判定するので、
        // 空配列ではなく undefined をそのまま渡す
        const row = statement.get(...values) as unknown as Array<unknown>
        return { rows: row }
      }
      return { rows: statement.all(...values) as unknown as Array<unknown> }
    },
    { schema },
  )

  return db as unknown as Db
}
