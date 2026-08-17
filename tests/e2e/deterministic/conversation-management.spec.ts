import { test, expect } from '@playwright/test'
import { chat, sendMessage } from '../conversation'
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

  test('opening a conversation without replying leaves it in its date bucket', async ({ page }) => {
    // Seeded through the localStorage migration: it is the one path that puts a
    // dated history in the store without sending anything, and the entry has to
    // be older than the resolution `touchConversation` ignores.
    await page.addInitScript(() => {
      localStorage.setItem(
        'conversationIds',
        JSON.stringify([
          { id: '/aged', firstMessage: 'Aged thread', timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
        ]),
      )
      localStorage.setItem(
        '/aged',
        JSON.stringify([{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Aged thread' }] }]),
      )
    })
    await page.goto('/')

    const row = sidebar(page).getByRole('link', { name: /Aged thread/ })
    await expect(row).toContainText('3d ago')

    await row.click()
    await expect(chat(page).getByText('Aged thread')).toBeVisible()

    // Leaving is where the pending write is flushed, so a read counted as
    // activity has already been stamped by the time the next chat is up.
    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()

    await expect(sidebar(page).getByText('Previous 7 days')).toBeVisible()
    await expect(row).toContainText('3d ago')
  })
})
