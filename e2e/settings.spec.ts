import { expect, type Page, test } from '@playwright/test'
import { signIn } from './helpers'

const adminPassword = process.env.E2E_ADMIN_PASSWORD
const extraPassword = process.env.E2E_EXTRA_PASSWORD

/**
 * パスワードを実際に書き換える検証は、明示的に許可されたローカル実行だけで動かす。
 * `E2E_BASE_URL` を向けた先（本番を含む）のパスワードを勝手に変えないため。
 * 途中で落ちると元に戻らないので、そのときは `pnpm db:seed` で戻す。
 */
const canChangePassword =
  process.env.E2E_PASSWORD_CHANGE === '1' && !process.env.E2E_BASE_URL

const TOP_URL = /\/(\?concert=\d+)?$/

test.describe('パスワードを変えずに済む検証', () => {
  test.skip(!adminPassword, 'E2E_ADMIN_PASSWORD が未設定')

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await signIn(page, adminPassword as string)
    await page.goto('/admin/settings')
  })

  test('確認用が食い違っていたら送信せずに止まる', async ({ page }) => {
    const form = passwordForm(page, 'エキストラ')
    await form.getByLabel('管理者の現在のパスワード').fill('whatever-goes')
    await form
      .getByLabel('エキストラの新しいパスワード')
      .fill('mismatching-password')
    await form.getByLabel('新しいパスワード（確認）').fill('other-password-x')
    await form.getByRole('button', { name: '保存' }).click()

    await expect(form.getByRole('alert')).toHaveText(
      '新しいパスワードと一致しません',
    )
  })

  test('短すぎる新しいパスワードは送信せずに止まる', async ({ page }) => {
    const form = passwordForm(page, 'エキストラ')
    await form.getByLabel('管理者の現在のパスワード').fill('whatever-goes')
    await form.getByLabel('エキストラの新しいパスワード').fill('short')
    await form.getByLabel('新しいパスワード（確認）').fill('short')
    await form.getByRole('button', { name: '保存' }).click()

    await expect(form.getByRole('alert')).toHaveText('12文字以上にしてください')
  })

  test('管理者の現在のパスワードが違えば変えられない', async ({ page }) => {
    const form = passwordForm(page, 'エキストラ')
    await form.getByLabel('管理者の現在のパスワード').fill('wrong-password')
    await form
      .getByLabel('エキストラの新しいパスワード')
      .fill('never-applied-password')
    await form
      .getByLabel('新しいパスワード（確認）')
      .fill('never-applied-password')
    await form.getByRole('button', { name: '保存' }).click()

    await expect(form.getByRole('alert')).toHaveText(
      '管理者のパスワードが違います',
    )
  })
})

test.describe('パスワードを実際に変える検証', () => {
  test.skip(
    !canChangePassword || !adminPassword || !extraPassword,
    'E2E_PASSWORD_CHANGE=1 とローカル実行、両ロールのパスワードが必要',
  )
  // 先が失敗して元に戻せていない状態で次を走らせない
  test.describe.configure({ mode: 'serial' })

  test('エキストラのパスワードを変えると、開いているセッションが落ちる', async ({
    page,
    browser,
  }) => {
    const temporary = 'temporary-extra-password'

    const extra = await browser.newContext()
    const extraPage = await extra.newPage()
    await extraPage.goto('/login')
    await signIn(extraPage, extraPassword as string)
    await expect(
      extraPage.getByText('エキストラとしてログイン中'),
    ).toBeVisible()

    await page.goto('/login')
    await signIn(page, adminPassword as string)
    await page.goto('/admin/settings')
    await changePassword(page, 'エキストラ', adminPassword as string, temporary)

    // 変更前から開いていた側は、次に画面を開いたところで締め出される
    await extraPage.goto('/')
    await expect(extraPage).toHaveURL(/\/login$/)

    await signIn(extraPage, extraPassword as string)
    await expect(extraPage.getByRole('alert')).toHaveText(
      'パスワードが違います。',
    )

    await signIn(extraPage, temporary)
    await expect(
      extraPage.getByText('エキストラとしてログイン中'),
    ).toBeVisible()
    await extra.close()

    await changePassword(
      page,
      'エキストラ',
      adminPassword as string,
      extraPassword as string,
    )
  })

  test('管理者のパスワードを変えると自分もログアウトされる', async ({
    page,
  }) => {
    const temporary = 'temporary-admin-password'

    await page.goto('/login')
    await signIn(page, adminPassword as string)
    await page.goto('/admin/settings')
    await changePassword(page, '管理者', adminPassword as string, temporary)

    await expect(
      page.getByRole('link', { name: 'ログイン画面へ' }),
    ).toBeVisible()
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)

    await signIn(page, adminPassword as string)
    await expect(page.getByRole('alert')).toHaveText('パスワードが違います。')

    await signIn(page, temporary)
    await expect(page).toHaveURL(TOP_URL)

    await page.goto('/admin/settings')
    await changePassword(page, '管理者', temporary, adminPassword as string)
  })
})

function passwordForm(page: Page, role: '管理者' | 'エキストラ') {
  return page.locator('form').filter({
    has: page.getByRole('heading', { name: `${role}のパスワード` }),
  })
}

async function changePassword(
  page: Page,
  role: '管理者' | 'エキストラ',
  current: string,
  next: string,
) {
  const form = passwordForm(page, role)
  await form.getByLabel('管理者の現在のパスワード').fill(current)
  await form.getByLabel(`${role}の新しいパスワード`).fill(next)
  await form.getByLabel('新しいパスワード（確認）').fill(next)
  await form.getByRole('button', { name: '保存' }).click()
}
