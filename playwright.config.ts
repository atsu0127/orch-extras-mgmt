import { defineConfig, devices } from '@playwright/test'

// 既定はローカルの dev サーバ。デプロイ先を検証したいときは
// E2E_BASE_URL を指定すると、サーバを起動せずそこへ接続する
const deployedBaseURL = process.env.E2E_BASE_URL
const baseURL = deployedBaseURL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // スマートフォン優先の UI なので、その幅で検証する
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  ...(deployedBaseURL
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
})
