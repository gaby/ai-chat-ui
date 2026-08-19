import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('sidebar', () => {
  test('new conversation appears in sidebar after sending message', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Sidebar test message')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    await expect(sidebar(page).getByText('Sidebar test message')).toBeVisible()
  })

  test('URL changes to conversation ID after sending', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'URL test')
    await expect(page).not.toHaveURL('/')
  })

  test('shift-clicking a conversation leaves the current tab where it is', async ({ page, context }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'First chat')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await sendMessage(page, 'text', 'Second chat')
    await expect(page.getByText('Hello from the test server')).toBeVisible()
    const secondUrl = page.url()

    // Shift means "open a window" the same way ctrl/cmd means "open a tab", and
    // the guard only knew about the latter — so a shift-click navigated the tab
    // the user was deliberately trying to keep.
    const opened = context.waitForEvent('page').catch(() => null)
    await sidebar(page)
      .getByText('First chat')
      .click({ modifiers: ['Shift'] })

    await expect(page).toHaveURL(secondUrl)
    await (await opened)?.close()
  })
})
