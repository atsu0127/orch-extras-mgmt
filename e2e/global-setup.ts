import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import process from 'node:process'

/**
 * ローカル D1 を E2E 用の固定状態にする。
 * `E2E_BASE_URL` があるときはデプロイ先を触らない（本番を初期化しない）。
 */
export default function globalSetup() {
  if (process.env.E2E_BASE_URL) {
    console.log('E2E_BASE_URL が設定されているため、D1 の初期化をスキップする')
    return
  }

  if (!existsSync('.dev.vars') && existsSync('.dev.vars.example')) {
    copyFileSync('.dev.vars.example', '.dev.vars')
  }

  execFileSync('pnpm', ['db:migrate'], { stdio: 'inherit' })
  execFileSync('pnpm', ['db:seed:reset'], { stdio: 'inherit' })
}
