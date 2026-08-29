import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

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

describe('createServerFn のログ middleware', () => {
  it('getCurrentSession 以外は logServerFn を通す', () => {
    const missing: Array<string> = []
    const pattern =
      /(?:export )?const (\w+) = createServerFn\s*\(([\s\S]*?)\)([\s\S]*?)\.handler/g

    for (const path of walk(SRC)) {
      const rel = relative(SRC, path).replaceAll('\\', '/')
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(pattern)) {
        const name = match[1]
        const chain = match[0]
        if (name === 'getCurrentSession') {
          expect(chain).not.toContain('logServerFn')
          continue
        }
        if (!chain.includes('logServerFn(')) {
          missing.push(`${rel} ${name}`)
        }
      }
    }

    expect(missing).toEqual([])
  })
})
