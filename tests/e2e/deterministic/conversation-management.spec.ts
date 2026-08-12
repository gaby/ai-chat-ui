import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { conversationAction, sidebar } from '../sidebar'

test.describe('conversation management', () => {
  test('renaming replaces the derived title everywhere', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'A message that makes a poor title')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    await conversationAction(page, 'A message that makes a poor title', 'Rename')

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

    await conversationAction(page, 'Keep me handy', 'Pin')

    await expect(sidebar(page).getByText('Pinned')).toBeVisible()

    await conversationAction(page, 'Keep me handy', 'Unpin')

    await expect(sidebar(page).getByText('Pinned')).toBeHidden()
  })
})
