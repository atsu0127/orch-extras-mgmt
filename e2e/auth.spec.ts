import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

// パスワードは secret なので環境変数から受け取る。未設定ならログインを伴う検証は飛ばす
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const extraPassword = process.env.E2E_EXTRA_PASSWORD

// 演奏会が登録されていると `?concert=<id>` が付く（設計書7.1）
const TOP_URL = /\/(\?concert=\d+)?$/

test('未ログインでトップを開くとログイン画面へ誘導される', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByLabel('パスワード')).toBeVisible()
})

test('未ログインで管理画面を開くとログイン画面へ誘導される', async ({
  page,
}) => {
  await page.goto('/admin')

  await expect(page).toHaveURL(/\/login$/)
})

test('間違ったパスワードでは入れない', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, 'wrong-password')

  await expect(page.getByRole('alert')).toHaveText('パスワードが違います。')
  await expect(page).toHaveURL(/\/login$/)
})

test.describe('extra としてログインする', () => {
  test.skip(!extraPassword, 'E2E_EXTRA_PASSWORD が未設定')

  test('閲覧画面には入れるが管理画面には入れない', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, extraPassword as string)

    await expect(page.getByText('エキストラとしてログイン中')).toBeVisible()

    await page.goto('/admin')
    await expect(page).toHaveURL(TOP_URL)
  })
})

test.describe('admin としてログインする', () => {
  test.skip(!adminPassword, 'E2E_ADMIN_PASSWORD が未設定')

  test('管理画面に入れて、ログアウトすると閲覧画面から締め出される', async ({
    page,
  }) => {
    await page.goto('/login')
    await signIn(page, adminPassword as string)

    await expect(page.getByText('管理者としてログイン中')).toBeVisible()

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/concerts(\?concert=\d+)?$/)
    await expect(
      page.getByRole('heading', { name: '演奏会', exact: true }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'ログアウト' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })
})
