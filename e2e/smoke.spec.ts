import { expect, test } from '@playwright/test'

test('トップページがクライアント側で描画される', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'エキストラ情報ポータル' }),
  ).toBeVisible()
})
