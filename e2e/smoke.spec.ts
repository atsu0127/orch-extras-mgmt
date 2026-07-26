import { expect, test } from '@playwright/test'

test('未ログインでトップを開くとログイン画面へ誘導される', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('パスワード')).toBeVisible()
})
