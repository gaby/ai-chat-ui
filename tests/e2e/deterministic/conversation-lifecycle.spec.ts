import { test, expect } from '@playwright/test'
import { chat, sendMessage, waitForPersisted } from '../conversation'
import { sidebar } from '../sidebar'

test.describe('conversation lifecycle', () => {
  test('messages persist across page reload', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Persist test')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await page.reload()
    await expect(chat(page).getByText('Persist test')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
  })

  test('switching conversations preserves messages', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'First conversation')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await sendMessage(page, 'text', 'Second conversation')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await expect(sidebar(page).getByText('First conversation')).toBeVisible()
    await expect(sidebar(page).getByText('Second conversation')).toBeVisible()

    await sidebar(page).getByText('First conversation').click()
    await expect(chat(page).getByText('First conversation')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
  })

  test('deleting active conversation navigates home', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Delete me')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    await sidebar(page).getByRole('button', { name: 'Conversation options: Delete me' }).click({ force: true })
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Chat deleted successfully')).toBeVisible()
    await expect(page).toHaveURL('/')
    await expect(sidebar(page).getByText('Delete me')).not.toBeVisible()
  })

  test('a deleted conversation stays deleted at its own URL', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Delete me for good')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const deletedUrl = page.url()

    await sidebar(page)
      .getByRole('button', { name: 'Conversation options: Delete me for good' })
      .click({ force: true })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Chat deleted successfully')).toBeVisible()

    // Deleting the conversation you are looking at navigates away, and leaving a
    // conversation flushes what was on screen — so the flush landed after the
    // delete and wrote the history back. The row was gone from the sidebar while
    // the URL still served the whole conversation.
    await page.goto(deletedUrl)
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await expect(chat(page).getByText('Delete me for good')).toHaveCount(0)
  })

  test('Back does not reopen the conversation that was just deleted', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Gone for good')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('button', { name: 'Conversation options: Gone for good' }).click({ force: true })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL('/')

    // The delete used to push `/` on top of the conversation, leaving it one
    // Back press away — where it opened as an empty chat whose messages were
    // then dropped by the guard that keeps a deleted conversation deleted.
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
  })

  test('Enter on the freshly opened delete dialog does not delete', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Spare me')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('button', { name: 'Conversation options: Spare me' }).click({ force: true })
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Focus opens on Cancel, and a dialog-wide Enter handler used to confirm
    // the delete regardless — so the opening keystroke destroyed the
    // conversation from the safe control.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    await expect(page.getByText('Chat deleted successfully')).toHaveCount(0)
    await expect(sidebar(page).getByText('Spare me')).toBeVisible()
  })

  test('Enter confirms once focus is on Delete', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Enter deletes me')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('button', { name: 'Conversation options: Enter deletes me' }).click({ force: true })
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Dropping the dialog-wide handler must not cost the keyboard path: Enter
    // still confirms, natively, on the button the user actually moved to.
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).focus()
    await page.keyboard.press('Enter')

    await expect(page.getByText('Chat deleted successfully')).toBeVisible()
    await expect(sidebar(page).getByText('Enter deletes me')).toHaveCount(0)
  })

  test('deleting inactive conversation preserves current view', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Keep this')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await sidebar(page).getByRole('link', { name: 'New conversation' }).click()
    await sendMessage(page, 'text', 'Remove this')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()

    await sidebar(page).getByText('Keep this').click()
    await expect(chat(page).getByText('Keep this')).toBeVisible()

    const currentUrl = page.url()
    await sidebar(page).getByRole('button', { name: 'Conversation options: Remove this' }).click({ force: true })
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(currentUrl)
    await expect(chat(page).getByText('Keep this')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
  })
})
