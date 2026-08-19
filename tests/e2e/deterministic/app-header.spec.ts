import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('app header', () => {
  test('names the current conversation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'New chat' })).toBeVisible()

    await sendMessage(page, 'text', 'Header title test')
    await expect(page.getByRole('heading', { name: 'Header title test' })).toBeVisible()
  })

  test('new chat returns to an empty conversation', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Something to leave behind')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    await page.getByRole('button', { name: 'New chat' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await expect(page.getByText('Hello from the test server')).toBeHidden()
  })
})
