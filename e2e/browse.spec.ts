import { expect, test } from '@playwright/test'
import { E2E_FIXTURE } from '../scripts/e2e-fixtures'
import { signIn } from './helpers'

const extraPassword = process.env.E2E_EXTRA_PASSWORD

test.describe('エキストラの閲覧導線', () => {
  test.skip(!extraPassword, 'E2E_EXTRA_PASSWORD が未設定')

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await signIn(page, extraPassword as string)
    await expect(page.getByText('エキストラとしてログイン中')).toBeVisible()
  })

  test('演奏会情報・資料・問い合わせが見える', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: E2E_FIXTURE.concertName }),
    ).toBeVisible()
    const performance = page.locator('section').filter({
      has: page.getByRole('heading', { name: E2E_FIXTURE.concertName }),
    })
    await expect(performance.getByText(E2E_FIXTURE.venueName)).toBeVisible()
    await expect(page.getByText(E2E_FIXTURE.concertNote)).toBeVisible()
    await expect(
      page.getByRole('link', { name: E2E_FIXTURE.resourceTitle }),
    ).toHaveAttribute('href', E2E_FIXTURE.resourceUrl)
    await expect(
      page.getByRole('link', { name: '出欠を回答する' }),
    ).toHaveAttribute('href', E2E_FIXTURE.attendanceUrl)
    await expect(
      page.getByRole('link', { name: '管理者へ問い合わせる' }),
    ).toHaveAttribute('href', new RegExp(`^mailto:${E2E_FIXTURE.adminEmail}`))
    await expect(page.getByText('次の練習')).toBeVisible()
    await expect(page.getByText('18:30〜21:00')).toBeVisible()
    await expect(page.getByText(E2E_FIXTURE.announcementTitle)).toBeVisible()
    await expect(page.getByText(E2E_FIXTURE.announcementBody)).toBeVisible()
    await expect(
      page.getByRole('link', { name: '関連リンクを開く' }),
    ).toHaveAttribute('href', E2E_FIXTURE.announcementUrl)
    await expect(
      page.getByText(E2E_FIXTURE.olderAnnouncementTitle),
    ).toBeVisible()
    await page.locator('.pamphlet-hero details summary').click()
    await expect(
      page.getByText(E2E_FIXTURE.upcomingPracticeDetail),
    ).toBeVisible()
  })

  test('練習日程で今後と過去を切り替えられる', async ({ page }) => {
    await page.getByRole('link', { name: '練習日程' }).click()
    await expect(page.getByRole('heading', { name: '練習日程' })).toBeVisible()

    const upcoming = page.locator('article').filter({ hasText: '18:30〜21:00' })
    await expect(upcoming.getByText(E2E_FIXTURE.venueName)).toBeVisible()
    await upcoming.getByText('詳細').click()
    await expect(
      upcoming.getByText(E2E_FIXTURE.upcomingPracticeDetail),
    ).toBeVisible()

    await page.getByRole('link', { name: /過去/ }).click()
    const past = page.locator('article').filter({ hasText: '13:00〜17:00' })
    await past.getByText('詳細').click()
    await expect(past.getByText(E2E_FIXTURE.pastPracticeDetail)).toBeVisible()
    await expect(
      past.getByRole('link', { name: E2E_FIXTURE.recordingTitle }),
    ).toHaveAttribute('href', E2E_FIXTURE.recordingUrl)
  })

  test('曲とボウイングが見える', async ({ page }) => {
    await page.getByRole('link', { name: '曲・ボウイング' }).click()
    await expect(
      page.getByRole('heading', { name: '曲・ボウイング' }),
    ).toBeVisible()

    await expect(page.getByText(E2E_FIXTURE.pieceWithBowing)).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'ボウイングあり' }),
    ).toHaveAttribute('href', E2E_FIXTURE.pieceWithBowingUrl)
    await expect(page.getByText(E2E_FIXTURE.pieceWithoutBowing)).toBeVisible()
    await expect(page.getByText(/楽譜リンク未設定/)).toBeVisible()
  })
})
