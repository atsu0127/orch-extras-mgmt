import { defineConfig } from 'vitest/config'

// サーバ側のロジックを対象にするため、Start のプラグインは読み込まない
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
