import { expect, type Page, test } from '@playwright/test'
import { E2E_FIXTURE } from '../scripts/e2e-fixtures'
import { signIn } from './helpers'

function assistantDialog(page: Page) {
  return page.getByRole('dialog', { name: 'AI案内' })
}

const extraPassword = process.env.E2E_EXTRA_PASSWORD
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test('未ログインでAI案内を開くとログイン画面へ誘導される', async ({ page }) => {
  await page.goto('/assistant')
  await expect(page).toHaveURL(/\/login$/)
})

test.describe('エキストラのAI案内', () => {
  test.skip(!extraPassword, 'E2E_EXTRA_PASSWORD が未設定')

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await signIn(page, extraPassword as string)
    await expect(page.getByText('エキストラとしてログイン中')).toBeVisible()
  })

  test('下部シートで質問し、専用ページへ同じ会話を引き継ぐ', async ({
    page,
  }) => {
    await expect(page.getByRole('button', { name: 'AIに聞く' })).toBeVisible()
    await page.getByRole('button', { name: 'AIに聞く' }).click()
    const sheet = assistantDialog(page)
    await expect(sheet).toBeVisible()
    await expect(
      sheet.locator('[data-assistant-placement="bottom"]'),
    ).toBeVisible()

    await sheet.getByRole('button', { name: '次の練習はいつですか？' }).click()
    await expect(sheet.getByText(/登録情報です/)).toBeVisible({
      timeout: 15_000,
    })
    await expect(sheet.getByText('根拠')).toBeVisible()
    await expect(
      sheet.getByRole('link', { name: /の練習/ }).first(),
    ).toBeVisible()

    await sheet.getByRole('link', { name: '専用ページで開く' }).click()
    await expect(page).toHaveURL(/\/assistant(\?concert=\d+)?$/)
    await expect(page.getByRole('heading', { name: 'AI案内' })).toBeVisible()
    await expect(page.getByText('次の練習はいつですか？')).toBeVisible()
    await expect(page.getByText(/登録情報です/)).toBeVisible()
    await expect(page.getByRole('button', { name: '履歴' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'AIに聞く' })).toHaveCount(0)
  })

  test('別演奏会を指定して根拠リンクを返す', async ({ page }) => {
    await page.getByRole('button', { name: 'AIに聞く' }).click()
    const sheet = assistantDialog(page)
    await sheet
      .getByLabel('質問')
      .fill(`演奏会「${E2E_FIXTURE.otherConcertName}」の出欠はどこですか？`)
    await sheet.getByRole('button', { name: '送信' }).click()
    await expect(sheet.getByText(/登録情報です/)).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      sheet.getByText(E2E_FIXTURE.otherConcertName).first(),
    ).toBeVisible()
    await expect(
      sheet.getByRole('link', { name: '出欠を回答する' }),
    ).toHaveAttribute('href', E2E_FIXTURE.otherAttendanceUrl)
  })

  test('登録本文中の命令を回答として採用しない', async ({ page }) => {
    await page.getByRole('button', { name: 'AIに聞く' }).click()
    const sheet = assistantDialog(page)
    await sheet
      .getByRole('button', { name: '新しいお知らせはありますか？' })
      .click()
    await expect(sheet.getByText(/登録情報です/)).toBeVisible({
      timeout: 15_000,
    })
    await expect(sheet.getByText(/HACKED/)).toHaveCount(0)
    await expect(
      sheet.getByText(E2E_FIXTURE.injectionAnnouncementTitle),
    ).toBeVisible()
  })

  test('失敗時は入力を残して再試行できる', async ({ page }) => {
    await page.getByRole('button', { name: 'AIに聞く' }).click()
    const sheet = assistantDialog(page)
    await sheet.getByLabel('質問').fill('これは失敗テストです')
    await sheet.getByRole('button', { name: '送信' }).click()
    await expect(sheet.getByRole('alert')).toContainText(
      '回答を作成できませんでした',
    )
    await expect(sheet.getByText('これは失敗テストです')).toBeVisible()
    await expect(
      sheet.getByRole('button', { name: 'もう一度試す' }),
    ).toBeVisible()
  })

  test('AI案内を閉じても既存の閲覧導線が使える', async ({ page }) => {
    await page.getByRole('button', { name: 'AIに聞く' }).click()
    await expect(assistantDialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(assistantDialog(page)).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: E2E_FIXTURE.concertName }),
    ).toBeVisible()
    await page.getByRole('link', { name: '練習日程' }).click()
    await expect(page.getByRole('heading', { name: '練習日程' })).toBeVisible()
  })
})

test.describe('PC幅のAI案内', () => {
  test.skip(!extraPassword, 'E2E_EXTRA_PASSWORD が未設定')
  test.use({ viewport: { width: 1280, height: 800 } })

  test('右側パネルが開き、ナビから専用ページへ行ける', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, extraPassword as string)
    await page.getByRole('button', { name: 'AIに聞く' }).click()
    const panel = assistantDialog(page)
    await expect(panel).toBeVisible()
    await expect(
      panel.locator('[data-assistant-placement="right"]'),
    ).toBeVisible()
    await panel.getByRole('link', { name: '専用ページで開く' }).click()
    await expect(page).toHaveURL(/\/assistant(\?concert=\d+)?$/)
    await expect(page.getByRole('heading', { name: 'AI案内' })).toBeVisible()
    await expect(page.getByLabel('会話履歴')).toBeVisible()
    await expect(page.getByRole('button', { name: '履歴' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'AI案内' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

test.describe('管理者のAI案内', () => {
  test.skip(!adminPassword, 'E2E_ADMIN_PASSWORD が未設定')

  test('管理者でも質問できる', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, adminPassword as string)
    await page.getByRole('button', { name: 'AIに聞く' }).click()
    const sheet = assistantDialog(page)
    await sheet
      .getByRole('button', { name: '出欠の回答先はどこですか？' })
      .click()
    await expect(sheet.getByText(/登録情報です/)).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      sheet.getByRole('link', { name: '出欠を回答する' }),
    ).toHaveAttribute('href', E2E_FIXTURE.attendanceUrl)
  })
})
