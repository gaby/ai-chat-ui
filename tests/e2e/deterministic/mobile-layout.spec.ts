import { test, expect } from '@playwright/test'
import { chat, sendMessage } from '../conversation'
import { sidebar } from '../sidebar'

// A phone, where the sidebar is an off-canvas sheet rather than a column. Every
// other spec runs at desktop width, so the shell below `md` — the only route to
// conversation history on a phone — had no coverage at all.
test.use({ viewport: { width: 390, height: 844 } })

test.describe('mobile layout', () => {
  test('the sidebar opens from the header and closes on a selection', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Reachable on a phone')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    // The trigger has to sit outside the drawer. Inside it, the drawer is the
    // only way to reach the control that opens the drawer.
    await expect(sidebar(page)).toBeHidden()
    await page.getByRole('button', { name: 'Toggle Sidebar' }).click()
    await expect(sidebar(page)).toBeVisible()

    // Left open, the sheet covers the conversation it was just used to pick,
    // and `Sidebar` hides the sheet's own close button.
    await sidebar(page).getByText('Reachable on a phone').click()
    await expect(sidebar(page)).toBeHidden()
  })

  test('the composer stays inside the viewport', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Fill the column')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    // `100vh` is the *large* viewport height on a phone: a shell sized in it
    // runs on under the browser chrome and takes the composer with it.
    const bottom = await page
      .getByPlaceholder('What would you like to know?')
      .evaluate((el) => el.getBoundingClientRect().bottom)
    expect(bottom).toBeLessThanOrEqual(844)
  })
})
