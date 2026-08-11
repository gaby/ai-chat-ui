import { test, expect } from '@playwright/test'

// The suite's rule is to drive the real test server rather than mock responses,
// because hand-rolled SSE payloads drift from the SDK. Aborting a request
// fabricates no payload — it reproduces a network condition the server cannot
// produce on demand, which is the only way to reach this state.
test.describe('unreachable backend', () => {
  test('says the agent could not be reached and offers a retry', async ({ page }) => {
    let failRequests = true
    await page.route('**/api/configure', (route) => (failRequests ? route.abort() : route.continue()))

    await page.goto('/')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText("Couldn't reach the agent", { timeout: 20_000 })

    // Recover: with the route let through, retrying repopulates the model select.
    failRequests = false
    await alert.getByRole('button', { name: 'Retry' }).click()

    await expect(alert).toBeHidden()
    await expect(page.getByRole('combobox').filter({ hasNotText: /^Effort:/ })).toBeVisible()
  })
})
