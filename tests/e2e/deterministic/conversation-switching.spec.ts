import { test, expect } from '@playwright/test'
import { chat, sendMessage, waitForPersisted } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('switching conversations mid-run', () => {
  test('a reply in flight does not follow the user into another conversation', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Conversation one')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    // Start a slow run, then leave before it finishes.
    await sendMessage(page, 'slow', 'Take your time')
    await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible()
    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()

    // The abandoned run must not stream into the new chat, nor be persisted there.
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await expect(page.getByText('Taking my time here.')).toBeHidden({ timeout: 15_000 })

    await sendMessage(page, 'text', 'Conversation two')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await expect(chat(page).getByText('Taking my time')).toBeHidden()
  })

  test('leaving a conversation keeps its history under its own id', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Keeper')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const keeperUrl = page.url()

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await sendMessage(page, 'text', 'Second thread')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    // The throttled save lags the switch; it must not attribute one
    // conversation's messages to the other.
    await page.goto(keeperUrl)
    await expect(chat(page).getByText('Keeper')).toBeVisible()
    await expect(chat(page).getByText('Second thread')).toBeHidden()
  })
})
