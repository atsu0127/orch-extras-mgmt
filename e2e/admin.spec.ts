import { expect, test } from '@playwright/test'
import { adminForm, selectConcert, signIn } from './helpers'

const adminPassword = process.env.E2E_ADMIN_PASSWORD

const VENUE = 'E2E検証ホール'
const VENUE_ADDRESS = '東京都中央区E2E-1-2'
const CONCERT = 'E2E検証演奏会'
const CONCERT_NOTE = 'E2E用の備考です'
const RESOURCE_TITLE = 'E2Eしおり'
const RESOURCE_URL = 'https://example.com/e2e/pamphlet'
const PRACTICE_DETAIL = 'E2E通し稽古'
const PRACTICE_DATE = '2099-03-15'
const DUPLICATE_DATE = '2099-03-22'
const PIECE_TITLE = 'E2E序曲'
const PIECE_COMPOSER = 'E2E作曲家'
const PIECE_BOWING = 'https://example.com/e2e/bowing'

test.describe('管理者の登録・編集導線', () => {
  test.skip(!adminPassword, 'E2E_ADMIN_PASSWORD が未設定')
  // 同じ D1 に書き込むため直列。途中失敗で汚れた状態を次へ持ち越さない
  test.describe.configure({ mode: 'serial' })

  test('会場・演奏会・資料・練習・曲を登録し、複製と閲覧反映を確認できる', async ({
    page,
  }) => {
    await page.goto('/login')
    await signIn(page, adminPassword as string)
    await expect(page.getByText('管理者としてログイン中')).toBeVisible()

    await page.goto('/admin/venues')
    const venueForm = adminForm(page, '会場を追加')
    await venueForm.getByLabel('名前').fill(VENUE)
    await venueForm.getByLabel('住所').fill(VENUE_ADDRESS)
    await venueForm.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText(VENUE, { exact: true })).toBeVisible()

    await page.goto('/admin/concerts')
    const concertForm = adminForm(page, '演奏会を追加')
    await concertForm.getByLabel('名前').fill(CONCERT)
    await concertForm.getByLabel('本番日（任意）').fill('2099-06-01')
    await concertForm.getByLabel('本番会場（任意）').selectOption({
      label: VENUE,
    })
    await concertForm
      .getByLabel('出欠の回答先 URL（任意）')
      .fill('https://example.com/e2e/attendance')
    await concertForm.getByLabel('備考（任意）').fill(CONCERT_NOTE)
    await concertForm.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText(CONCERT, { exact: true })).toBeVisible()

    await selectConcert(page, CONCERT)

    const concertItem = page.locator('li').filter({ hasText: CONCERT }).first()
    await concertItem.getByRole('button', { name: '資料リンクを追加' }).click()
    const resourceForm = adminForm(page, '資料リンクを追加')
    await resourceForm.getByLabel('タイトル').fill(RESOURCE_TITLE)
    await resourceForm.getByLabel('URL').fill(RESOURCE_URL)
    await resourceForm.getByRole('button', { name: '保存' }).click()
    await expect(page.getByRole('link', { name: RESOURCE_TITLE })).toBeVisible()

    await page.goto('/admin/practices')
    const practiceForm = adminForm(page, '練習を追加')
    await practiceForm.getByLabel('日付').fill(PRACTICE_DATE)
    await practiceForm.getByLabel('開始（任意）').fill('19:00')
    await practiceForm.getByLabel('終了（任意）').fill('21:00')
    await practiceForm.getByLabel('会場（任意）').selectOption({
      label: VENUE,
    })
    await practiceForm.getByLabel('詳細（任意）').fill(PRACTICE_DETAIL)
    await practiceForm.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText(PRACTICE_DETAIL)).toBeVisible()

    const practiceItem = page
      .locator('li')
      .filter({ hasText: PRACTICE_DETAIL })
      .first()
    await practiceItem
      .getByRole('button', { name: '録音・録画リンクを追加' })
      .click()
    const mediaForm = adminForm(page, '録音・録画リンクを追加')
    await mediaForm.getByLabel('表示名').fill('E2E録音')
    await mediaForm.getByLabel('URL').fill('https://example.com/e2e/recording')
    await mediaForm.getByRole('button', { name: '保存' }).click()
    await expect(page.getByRole('link', { name: 'E2E録音' })).toBeVisible()

    await practiceItem.getByRole('button', { name: '複製して編集' }).click()

    const duplicateForm = adminForm(page, '練習を追加')
    await expect(duplicateForm.getByLabel('詳細（任意）')).toHaveValue(
      PRACTICE_DETAIL,
    )
    await expect(duplicateForm.getByLabel('開始（任意）')).toHaveValue('19:00')
    await expect(duplicateForm.getByLabel('日付')).toHaveValue('')
    await duplicateForm.getByLabel('日付').fill(DUPLICATE_DATE)
    await duplicateForm.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('3月15日')).toBeVisible()
    await expect(page.getByText('3月22日')).toBeVisible()

    const duplicatedItem = page
      .locator('li')
      .filter({ hasText: '3月22日' })
      .filter({ hasText: PRACTICE_DETAIL })
    await expect(
      duplicatedItem.getByRole('link', { name: 'E2E録音' }),
    ).toHaveCount(0)

    await page.goto('/admin/pieces')
    const pieceForm = adminForm(page, '曲を追加')
    await pieceForm.getByLabel('曲名').fill(PIECE_TITLE)
    await pieceForm.getByLabel('作曲者（任意）').fill(PIECE_COMPOSER)
    await pieceForm.getByLabel('ボウイングURL（任意）').fill(PIECE_BOWING)
    await pieceForm.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText(PIECE_TITLE)).toBeVisible()

    await page.getByRole('link', { name: 'ホーム' }).click()
    await selectConcert(page, CONCERT)
    await expect(page.getByRole('heading', { name: CONCERT })).toBeVisible()
    await expect(page.getByText(CONCERT_NOTE)).toBeVisible()
    await expect(
      page.getByRole('link', { name: RESOURCE_TITLE }),
    ).toHaveAttribute('href', RESOURCE_URL)
    await expect(page.getByText(PRACTICE_DETAIL)).toBeVisible()

    await page.getByRole('link', { name: '練習日程' }).click()
    await expect(page.getByText('3月15日')).toBeVisible()
    await expect(page.getByText('3月22日')).toBeVisible()

    await page.getByRole('link', { name: '曲・ボウイング' }).click()
    await expect(
      page.getByRole('link', { name: new RegExp(PIECE_TITLE) }),
    ).toHaveAttribute('href', PIECE_BOWING)
  })
})
