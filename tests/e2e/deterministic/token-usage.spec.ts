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
    const total = async () => {
      // Read the exact figure from the breakdown; the chip itself is rounded.
      await summary.click()
      const text = await page.getByLabel('Total tokens').innerText()
      await page.keyboard.press('Escape')
      return Number(text.replace(/\D/g, ''))
    }

    await sendMessage(page, 'text', 'First turn')
    await expect(page.getByText('Hello from the test server').first()).toBeVisible()
    const afterFirst = await total()
    expect(afterFirst).toBeGreaterThan(0)

    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Second turn')
    await input.press('Enter')
    await expect(page.getByText('Hello from the test server').nth(1)).toBeVisible()

    // The second reply's usage is added to the first, not swapped for it.
    await expect
      .poll(total, { message: 'conversation total should grow with the second turn' })
      .toBeGreaterThan(afterFirst)
  })

  test('a reply reports its own input and output counts', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Show per-reply usage')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    // Sits with the reply's other actions, revealed on hover.
    await page.getByText('Hello from the test server').hover()
    await expect(page.getByTitle(/input, .* output/)).toBeVisible()
  })

  test('falls back to the total when a backend reports no breakdown', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'total-only-usage', 'Report only a total')
    await expect(page.getByText('Hello from the test server')).toBeVisible()

    // `totalTokens` alone is a supported shape. Rendering the breakdown anyway
    // put "0 in, 0 out" on a reply that cost real tokens.
    await page.getByText('Hello from the test server').hover()
    await expect(page.getByTitle('Total tokens for this reply')).toBeVisible()
    await expect(page.getByTitle('Total tokens for this reply')).not.toContainText(/^0 /)
    await expect(page.getByTitle(/input, .* output/)).toHaveCount(0)

    // The popover presents its rows as what the agent reported, so a split it
    // never sent must be absent rather than zero.
    await page.getByRole('button', { name: 'Token usage' }).click()
    await expect(page.getByText('Reported by the agent.')).toBeVisible()
    await expect(page.getByLabel('Total tokens')).not.toHaveText('0')
    await expect(page.getByLabel('Input tokens')).toHaveCount(0)
    await expect(page.getByLabel('Output tokens')).toHaveCount(0)
  })
})
