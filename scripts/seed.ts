import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { hashPassword } from '../src/auth/password'
import { E2E_FIXTURE } from './e2e-fixtures'

const remote = process.argv.includes('--remote')
const reset = process.argv.includes('--reset')
const target = remote ? '--remote' : '--local'
const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler')

// 本番の pepper はシェル側から渡す。ローカルの値を混ぜるとハッシュが食い違う
if (!remote && existsSync('.dev.vars')) {
  process.loadEnvFile('.dev.vars')
}

async function main() {
  // 本番 D1 を一括削除しない。E2E の再現用リセットはローカル専用
  if (reset && remote) {
    throw new Error('--reset はローカル専用です。--remote との併用は拒否します')
  }

  const pepper = requireEnv('PASSWORD_PEPPER')
  const now = new Date().toISOString()

  const statements: Array<string> = []

  if (reset) {
    statements.push(...clearData())
  }

  statements.push(
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
  )

  if (reset || isEmptyDatabase()) {
    statements.push(...sampleData(now))
  } else {
    console.log('既存データがあるため、サンプルの演奏会は投入しない')
  }

  execute(statements.join('\n'))
  console.log(
    reset
      ? `データを初期化し、両ロールのパスワードを投入した（${target}）`
      : `両ロールのパスワードを投入した（${target}）`,
  )
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

/**
 * 参照順に消す。CASCADE に頼り切らず、認証まわりもまとめて空にする。
 * 固定 id のサンプルを入れ直す前提なので sqlite_sequence も戻す。
 */
function clearData(): Array<string> {
  return [
    'DELETE FROM practice_media;',
    'DELETE FROM pieces;',
    'DELETE FROM concert_resources;',
    'DELETE FROM practices;',
    'DELETE FROM link_checks;',
    'DELETE FROM concerts;',
    'DELETE FROM venues;',
    'DELETE FROM sessions;',
    'DELETE FROM login_attempts;',
    'DELETE FROM app_settings;',
    'DELETE FROM credentials;',
    `DELETE FROM sqlite_sequence WHERE name IN (
  'practice_media', 'pieces', 'concert_resources', 'practices',
  'link_checks', 'concerts', 'venues', 'login_attempts'
);`,
  ]
}

function sampleData(now: string): string[] {
  const f = E2E_FIXTURE
  return [
    `INSERT INTO venues (id, name, address, note, created_at, updated_at)
VALUES (1, ${text(f.venueName)}, ${text(f.venueAddress)}, ${text(f.venueNote)}, ${text(now)}, ${text(now)});`,

    `INSERT INTO concerts (id, name, performance_date, venue_id, attendance_url, attendance_note, note, status, created_at, updated_at)
VALUES (1, ${text(f.concertName)}, ${text(jstDate(60))}, 1, ${text(f.attendanceUrl)}, ${text(f.attendanceNote)}, ${text(f.concertNote)}, 'active', ${text(now)}, ${text(now)});`,

    `INSERT INTO concert_resources (id, concert_id, title, url, sort_order, created_at, updated_at)
VALUES (1, 1, ${text(f.resourceTitle)}, ${text(f.resourceUrl)}, 0, ${text(now)}, ${text(now)});`,

    `INSERT INTO app_settings (id, admin_email, created_at, updated_at)
VALUES (1, ${text(f.adminEmail)}, ${text(now)}, ${text(now)});`,

    `INSERT INTO practices (id, concert_id, date, start_time, end_time, venue_id, detail, created_at, updated_at)
VALUES
  (1, 1, ${text(jstDate(-14))}, '13:00', '17:00', 1, ${text(f.pastPracticeDetail)}, ${text(now)}, ${text(now)}),
  (2, 1, ${text(jstDate(7))}, '18:30', '21:00', 1, ${text(f.upcomingPracticeDetail)}, ${text(now)}, ${text(now)});`,

    `INSERT INTO practice_media (id, practice_id, title, url, sort_order, created_at, updated_at)
VALUES (1, 1, ${text(f.recordingTitle)}, ${text(f.recordingUrl)}, 0, ${text(now)}, ${text(now)});`,

    `INSERT INTO pieces (id, concert_id, title, composer, sort_order, bowing_url, created_at, updated_at)
VALUES
  (1, 1, ${text(f.pieceWithBowing)}, ${text(f.pieceWithBowingComposer)}, 0, ${text(f.pieceWithBowingUrl)}, ${text(now)}, ${text(now)}),
  (2, 1, ${text(f.pieceWithoutBowing)}, ${text(f.pieceWithoutBowingComposer)}, 1, NULL, ${text(now)}, ${text(now)});`,
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
