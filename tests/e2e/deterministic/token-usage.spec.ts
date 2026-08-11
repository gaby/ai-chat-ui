import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

// The test server attaches the run's usage to the assistant message metadata,
// the same contract a real backend uses (see `UsageEventStream` in
// tests/server/server.py).
test.describe('token usage', () => {
  test('counts tokens for the conversation and breaks them down', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Count my tokens')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    const summary = page.getByRole('button', { name: 'Token usage' })
    await expect(summary).toContainText('tokens')
    // Reported numbers are exact, so they carry no approximation marker.
    await expect(summary).not.toContainText('~')

    await summary.click()
    await expect(page.getByText('Reported by the agent.')).toBeVisible()
    await expect(page.getByText('Input', { exact: true })).toBeVisible()
    await expect(page.getByText('Output', { exact: true })).toBeVisible()
    await expect(page.getByText('Model requests')).toBeVisible()
  })

  test('accumulates across turns', async ({ page }) => {
    await page.goto('/')
    const summary = page.getByRole('button', { name: 'Token usage' })

    await sendMessage(page, 'text', 'First turn')
    await expect(page.getByText('Hello from the test server').first()).toBeVisible()
    const afterFirst = await summary.innerText()

    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Second turn')
    await input.press('Enter')
    await expect(page.getByText('Hello from the test server').nth(1)).toBeVisible()

    await expect(summary).not.toHaveText(afterFirst)
  })

  test('a reply reports its own input and output counts', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Show per-reply usage')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    // Sits with the reply's other actions, revealed on hover.
    await page.getByText('Hello from the test server').hover()
    await expect(page.getByTitle(/input, .* output/)).toBeVisible()
  })
})
