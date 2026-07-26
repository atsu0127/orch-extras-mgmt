import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// サーバ側のロジックを対象にするため、Start のプラグインは読み込まない
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL('./src/test/cloudflare-workers-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
