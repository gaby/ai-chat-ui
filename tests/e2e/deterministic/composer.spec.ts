import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('composer', () => {
  test('reports that the agent is working before the first token', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'slow', 'Take your time')

    await expect(page.getByRole('status')).toContainText('Thinking')
    await expect(page.getByText('Taking my time here.')).toBeVisible({ timeout: 15_000 })
  })

  test('offers a stop control while a run is in flight', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'slow', 'Take your time')

    const stop = page.getByRole('button', { name: 'Stop generating' })
    await expect(stop).toBeVisible()
    await stop.click()

    // Back to a sendable composer, with whatever streamed so far left in place.
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible()
    await expect(stop).toBeHidden()
  })

  test('send is disabled until there is a message to send', async ({ page }) => {
    await page.goto('/')

    const send = page.getByRole('button', { name: 'Send message' })
    await expect(send).toBeDisabled()

    await page.getByPlaceholder('What would you like to know?').fill('Hello')
    await expect(send).toBeEnabled()
  })
})
