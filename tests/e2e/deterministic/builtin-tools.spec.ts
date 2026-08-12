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

  test('overflow tools carry their on/off state, not just a check icon', async ({ page }) => {
    await page.goto('/')

    // `markdown` advertises four tools; three fit the bar and the rest move into
    // the overflow menu.
    await page
      .getByRole('combobox')
      .filter({ hasNotText: /^Effort:/ })
      .click()
    await page.getByRole('option', { name: 'markdown', exact: true }).click()

    await page.getByRole('button', { name: 'More tools' }).click()

    // These rows were plain menu items whose state lived in an unlabelled check
    // icon, so a screen reader read an enabled tool exactly like a disabled one.
    const urlContext = page.getByRole('menuitemcheckbox', { name: 'URL context' })
    await expect(urlContext).toHaveAttribute('aria-checked', 'false')

    await urlContext.click()
    await expect(urlContext).toHaveAttribute('aria-checked', 'true')

    // The menu stays open so several can be flipped in one visit.
    await expect(urlContext).toBeVisible()
    await page.keyboard.press('Escape')

    const requestPromise = page.waitForRequest('**/api/chat')
    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Read that page')
    await input.press('Enter')

    const body = (await requestPromise).postDataJSON() as Record<string, unknown>
    expect(body.builtinTools).toEqual(['url_context'])
  })
})
