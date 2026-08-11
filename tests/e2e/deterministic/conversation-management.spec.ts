import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('conversation management', () => {
  test('renaming replaces the derived title everywhere', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'A message that makes a poor title')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    await sidebar(page)
      .getByRole('button', { name: 'Conversation options: A message that makes a poor title' })
      .click({ force: true })
    await page.getByRole('menuitem', { name: 'Rename' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Conversation name').fill('Weather research')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(sidebar(page).getByText('Weather research')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Weather research' })).toBeVisible()
    await expect(sidebar(page).getByText('A message that makes a poor title')).toBeHidden()
  })

  test('pinning lifts a conversation above the date buckets', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Keep me handy')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    await expect(sidebar(page).getByText('Pinned')).toBeHidden()

    await sidebar(page).getByRole('button', { name: 'Conversation options: Keep me handy' }).click({ force: true })
    await page.getByRole('menuitem', { name: 'Pin' }).click()

    await expect(sidebar(page).getByText('Pinned')).toBeVisible()

    await sidebar(page).getByRole('button', { name: 'Conversation options: Keep me handy' }).click({ force: true })
    await page.getByRole('menuitem', { name: 'Unpin' }).click()

    await expect(sidebar(page).getByText('Pinned')).toBeHidden()
  })
})
