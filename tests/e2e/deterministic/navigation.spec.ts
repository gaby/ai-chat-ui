import { test, expect } from '@playwright/test'
import { chat, sendMessage, waitForPersisted } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('navigation', () => {
  test('Back returns to the conversation, however often New chat was pressed', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Somewhere to come back to')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const conversationUrl = page.url()

    // Pressing it again while already on a new chat used to stack identical `/`
    // entries, so Back had to walk through each one before appearing to work.
    await page.getByRole('button', { name: 'New chat' }).click()
    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: 'New chat' }).click()
    await page.getByRole('button', { name: 'New chat' }).click()

    await page.goBack()
    await expect(page).toHaveURL(conversationUrl)
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('picking a conversation closes the drawer covering it', async ({ page }) => {
      await page.goto('/')
      await sendMessage(page, 'text', 'Pick me from the drawer')
      await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
      await waitForPersisted(page)

      await page.goto('/')
      await sendMessage(page, 'text', 'The one in the way')
      await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
      await waitForPersisted(page)

      await page.getByRole('button', { name: 'Toggle sidebar' }).click()
      const drawer = page.getByRole('dialog')
      await expect(drawer).toBeVisible()

      // The drawer covers the whole screen at this width, and `Sidebar` hides
      // the sheet's own close button — left open, it hides the conversation it
      // was just used to choose.
      await sidebar(page).getByText('Pick me from the drawer').click()
      await expect(drawer).toBeHidden()
      await expect(chat(page).getByText('Pick me from the drawer')).toBeVisible()
    })
  })
})
