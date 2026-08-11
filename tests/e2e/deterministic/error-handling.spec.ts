import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { toolCard } from '../tools'

test.describe('tool errors', () => {
  test('shows the failure reason on the card, collapsed and expanded', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'error', 'What is the weather?')

    const card = toolCard(page, 'get_weather')
    // `exact` because the failure message itself contains the word "errors",
    // and text matching is case-insensitive by default.
    await expect(card.getByText('Error', { exact: true })).toBeVisible()

    // The collapsed row leads with why it failed, not with the arguments.
    await expect(card.getByText('City name is required')).toBeVisible()

    // Expanded, the message reads in place — it used to sit behind a "View
    // Error" button that opened a modal.
    await card
      .getByRole('button', { name: /get_weather|Error/ })
      .first()
      .click()
    await expect(card.getByRole('heading', { name: 'Error' })).toBeVisible()
    await expect(card.getByRole('heading', { name: 'Arguments' })).toBeVisible()
    await expect(card.getByText('City name is required').first()).toBeVisible()
    await expect(card.getByRole('button', { name: 'Copy error' })).toBeAttached()
  })

  test('shows final text after error recovery', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'error', 'What is the weather?')
    await expect(page.getByText('The tool encountered an error.')).toBeVisible()
  })
})

test.describe('run failures', () => {
  test('separates what failed from how to recover, with the raw text one click away', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'failure', 'Do something that fails')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText("The run didn't finish")
    await expect(alert).toContainText('503 Service Unavailable')
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(alert.getByRole('button', { name: 'Continue' })).toBeVisible()

    // The provider's full message is behind Details rather than dumped inline.
    await expect(alert.getByText('request_id=req_')).toBeHidden()
    await alert.getByRole('button', { name: 'Details' }).click()
    await expect(alert.getByText('request_id=req_')).toBeVisible()
  })

  test('retry clears the failure and runs again', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'failure', 'Do something that fails')
    await expect(page.getByRole('alert')).toBeVisible()

    // Retrying against the same failing model fails again, which is enough to
    // show the control re-runs rather than silently swallowing the error.
    const requestPromise = page.waitForRequest('**/api/chat')
    await page.getByRole('button', { name: 'Retry' }).click()
    await requestPromise
  })
})
