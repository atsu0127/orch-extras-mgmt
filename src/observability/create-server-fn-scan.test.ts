import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')
const HELPER = 'observability/logged-server-fn.ts'
const SESSION_FILE = 'auth/functions.ts'

function walk(dir: string): Array<string> {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: Array<string> = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(path))
      continue
    }
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
    if (entry.name.includes('.test.')) continue
    files.push(path)
  }
  return files
}

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length
}

describe('createServerFn のログ middleware', () => {
  it('getCurrentSession 以外は loggedServerFn を通す', () => {
    const missing: Array<string> = []
    const sessionViolations: Array<string> = []

    for (const path of walk(SRC)) {
      const rel = relative(SRC, path).replaceAll('\\', '/')
      const source = readFileSync(path, 'utf8')
      const createCount = count(source, /\bcreateServerFn\s*\(/g)
      const loggedCount = count(source, /\bloggedServerFn\s*\(/g)

      if (rel === HELPER) {
        expect(createCount).toBe(1)
        expect(source).toContain('logServerFn(fn)')
        continue
      }

      if (rel === SESSION_FILE) {
        expect(source).toMatch(
          /export const getCurrentSession = createServerFn\(\{\s*method: 'GET'\s*\}\)\.handler/,
        )
        expect(source).not.toMatch(/getCurrentSession = loggedServerFn/)
        expect(loggedCount).toBeGreaterThan(0)
        expect(createCount).toBe(1)
        continue
      }

      if (createCount > 0) missing.push(`${rel} (${createCount})`)
      if (
        loggedCount === 0 &&
        /\bcreateServerFn\b/.test(source) === false &&
        /\bloggedServerFn\b/.test(source)
      ) {
        sessionViolations.push(rel)
      }
    }

    expect(missing).toEqual([])
    expect(sessionViolations).toEqual([])
  })
})
