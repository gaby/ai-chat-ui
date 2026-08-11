import { test, expect } from '@playwright/test'

// The default model (`text`, first in the registry) is the one the test server
// advertises a builtin tool for, so no model selection is needed here.
test.describe('builtin tools', () => {
  test('an enabled tool shows as a pill and is sent with the message', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await page.getByRole('switch', { name: 'Web search' }).click()
    await page.keyboard.press('Escape')

    const pill = page.getByRole('button', { name: 'Turn off Web search' })
    await expect(pill).toBeVisible()

    const requestPromise = page.waitForRequest('**/api/chat')
    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('Look something up')
    await input.press('Enter')

    const body = (await requestPromise).postDataJSON() as Record<string, unknown>
    expect(body.builtinTools).toEqual(['web_search'])
  })

  test('the pill turns the tool back off', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Tools', exact: true }).click()
    await page.getByRole('switch', { name: 'Web search' }).click()
    await page.keyboard.press('Escape')

    const pill = page.getByRole('button', { name: 'Turn off Web search' })
    await pill.click()

    await expect(pill).toBeHidden()
  })
})
