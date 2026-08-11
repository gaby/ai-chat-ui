import { test, expect } from '@playwright/test'

// The default model (`text`, first in the registry) is the one the test server
// advertises a builtin tool for, so no model selection is needed here.
test.describe('builtin tools', () => {
  test('a tool toggles on from the composer and is sent with the message', async ({ page }) => {
    await page.goto('/')

    const webSearch = page.getByRole('button', { name: 'Web search' })
    await expect(webSearch).toHaveAttribute('aria-pressed', 'false')

    await webSearch.click()
    await expect(webSearch).toHaveAttribute('aria-pressed', 'true')

    const requestPromise = page.waitForRequest('**/api/chat')
    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Look something up')
    await input.press('Enter')

    const body = (await requestPromise).postDataJSON() as Record<string, unknown>
    expect(body.builtinTools).toEqual(['web_search'])
  })

  test('clicking the chip again turns the tool back off', async ({ page }) => {
    await page.goto('/')

    const webSearch = page.getByRole('button', { name: 'Web search' })
    await webSearch.click()
    await expect(webSearch).toHaveAttribute('aria-pressed', 'true')

    await webSearch.click()
    await expect(webSearch).toHaveAttribute('aria-pressed', 'false')

    const requestPromise = page.waitForRequest('**/api/chat')
    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Never mind')
    await input.press('Enter')

    const body = (await requestPromise).postDataJSON() as Record<string, unknown>
    expect(body.builtinTools).toEqual([])
  })
})
