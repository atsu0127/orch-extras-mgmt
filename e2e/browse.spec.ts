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
    await expect(page.getByText(E2E_FIXTURE.venueName)).toBeVisible()
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
    await expect(
      page.getByText(E2E_FIXTURE.upcomingPracticeDetail),
    ).toBeVisible()
  })

  test('練習日程で今後と過去を切り替えられる', async ({ page }) => {
    await page.getByRole('link', { name: '練習日程' }).click()
    await expect(page.getByRole('heading', { name: '練習日程' })).toBeVisible()

    await expect(
      page.getByText(E2E_FIXTURE.upcomingPracticeDetail),
    ).toBeVisible()

    await page.getByRole('link', { name: /過去/ }).click()
    await expect(page.getByText(E2E_FIXTURE.pastPracticeDetail)).toBeVisible()
    await expect(
      page.getByRole('link', { name: E2E_FIXTURE.recordingTitle }),
    ).toHaveAttribute('href', E2E_FIXTURE.recordingUrl)
  })

  test('曲とボウイングが見える', async ({ page }) => {
    await page.getByRole('link', { name: '曲・ボウイング' }).click()
    await expect(
      page.getByRole('heading', { name: '曲・ボウイング' }),
    ).toBeVisible()

    await expect(
      page.getByRole('link', {
        name: new RegExp(E2E_FIXTURE.pieceWithBowing),
      }),
    ).toHaveAttribute('href', E2E_FIXTURE.pieceWithBowingUrl)
    await expect(page.getByText(E2E_FIXTURE.pieceWithoutBowing)).toBeVisible()
    await expect(page.getByText(/ボウイング未設定|未設定/)).toBeVisible()
  })
})
