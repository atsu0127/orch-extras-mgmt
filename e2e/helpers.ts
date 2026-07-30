import type { Page } from '@playwright/test'

export async function signIn(page: Page, password: string) {
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン' }).click()
}
