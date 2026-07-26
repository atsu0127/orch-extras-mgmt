import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { hashPassword } from '../src/auth/password'

const remote = process.argv.includes('--remote')
const target = remote ? '--remote' : '--local'
const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler')

// 本番の pepper はシェル側から渡す。ローカルの値を混ぜるとハッシュが食い違う
if (!remote && existsSync('.dev.vars')) {
  process.loadEnvFile('.dev.vars')
}

async function main() {
  const pepper = requireEnv('PASSWORD_PEPPER')
  const now = new Date().toISOString()

  const statements = [
    upsertCredential(
      'admin',
      await hashPassword(requireEnv('ADMIN_INITIAL_PASSWORD'), pepper),
      now,
    ),
    upsertCredential(
      'extra',
      await hashPassword(requireEnv('EXTRA_INITIAL_PASSWORD'), pepper),
      now,
    ),
  ]

  if (isEmptyDatabase()) {
    statements.push(...sampleData(now))
  } else {
    console.log('既存データがあるため、サンプルの演奏会は投入しない')
  }

  execute(statements.join('\n'))
  console.log(`両ロールのパスワードを投入した（${target}）`)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} が設定されていない。ローカルなら .dev.vars に、本番なら実行時の環境変数として渡す`,
    )
  }
  return value
}

/** サンプルは固定 id で入れるため、衝突しない空の状態のときだけ投入する */
function isEmptyDatabase(): boolean {
  const output = execFileSync(
    wrangler,
    [
      'd1',
      'execute',
      'DB',
      target,
      '--json',
      '--command',
      'SELECT (SELECT COUNT(*) FROM venues) + (SELECT COUNT(*) FROM concerts) AS n',
    ],
    { encoding: 'utf8' },
  )
  const [{ results }] = JSON.parse(output) as [{ results: [{ n: number }] }]
  return results[0].n === 0
}

function execute(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'oem-seed-'))
  const file = join(dir, 'seed.sql')
  try {
    writeFileSync(file, sql)
    execFileSync(wrangler, ['d1', 'execute', 'DB', target, '--file', file], {
      stdio: 'inherit',
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function upsertCredential(role: string, hash: string, now: string): string {
  return `INSERT INTO credentials (role, password_hash, updated_at)
VALUES (${text(role)}, ${text(hash)}, ${text(now)})
ON CONFLICT(role) DO UPDATE SET
  password_hash = excluded.password_hash,
  updated_at = excluded.updated_at;`
}

function sampleData(now: string): string[] {
  return [
    `INSERT INTO venues (id, name, address, note, created_at, updated_at)
VALUES (1, '市民会館 大練習室', '東京都千代田区1-2-3', '駅から徒歩10分', ${text(now)}, ${text(now)});`,

    `INSERT INTO concerts (id, name, performance_date, venue_id, attendance_url, attendance_note, status, created_at, updated_at)
VALUES (1, '第10回定期演奏会', ${text(jstDate(60))}, 1, 'https://example.com/attendance', '本番1か月前までに回答してください', 'active', ${text(now)}, ${text(now)});`,

    `INSERT INTO practices (id, concert_id, date, start_time, end_time, venue_id, detail, created_at, updated_at)
VALUES
  (1, 1, ${text(jstDate(-14))}, '13:00', '17:00', 1, '前半に1・2楽章、後半に通し', ${text(now)}, ${text(now)}),
  (2, 1, ${text(jstDate(7))}, '18:30', '21:00', 1, '弦分奏', ${text(now)}, ${text(now)});`,

    `INSERT INTO practice_media (id, practice_id, title, url, sort_order, created_at, updated_at)
VALUES (1, 1, '1楽章 通し', 'https://example.com/recordings/1', 0, ${text(now)}, ${text(now)});`,

    `INSERT INTO pieces (id, concert_id, title, composer, sort_order, bowing_url, created_at, updated_at)
VALUES
  (1, 1, '交響曲第5番', 'ベートーヴェン', 0, 'https://example.com/bowing/1', ${text(now)}, ${text(now)}),
  (2, 1, 'フィンランディア', 'シベリウス', 1, NULL, ${text(now)}, ${text(now)});`,
  ]
}

/** 日本時間は固定で UTC+9 なので、オフセットを足してから日付部分を取る */
function jstDate(offsetDays: number): string {
  const millis = Date.now() + (9 + offsetDays * 24) * 60 * 60 * 1000
  return new Date(millis).toISOString().slice(0, 10)
}

function text(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

await main()
