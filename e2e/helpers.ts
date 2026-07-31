import type { Locator, Page } from '@playwright/test'

export async function signIn(page: Page, password: string) {
  await page.getByLabel('パスワード').fill(password)
  await page.getByRole('button', { name: 'ログイン' }).click()
}

/** 見出し付きの管理フォームを1枚に絞る（同名ラベルが複数あるため） */
export function adminForm(page: Page, title: string): Locator {
  return page.locator('form').filter({
    has: page.getByRole('heading', { name: title }),
  })
}

export async function selectConcert(page: Page, name: string) {
  const selector = page.locator('#concert-selector')
  const option = selector.locator('option').filter({ hasText: name }).first()
  const value = await option.getAttribute('value')
  if (!value) {
    throw new Error(`演奏会「${name}」がセレクタに見つからない`)
  }
  await selector.selectOption(value)
}
