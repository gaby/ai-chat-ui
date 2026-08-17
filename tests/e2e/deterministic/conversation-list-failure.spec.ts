import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { chat, sendMessage, waitForPersisted } from '../conversation'
import { sidebar } from '../sidebar'

declare global {
  interface Window {
    failConversationReads?: boolean
  }
}

/**
 * Make reads of the conversations store fail until the test says otherwise.
 *
 * Not a network mock — the ban in `tests/CLAUDE.md` is about faking the SSE wire
 * protocol, which drifts. This fakes browser storage misbehaving, which has no
 * other way to be provoked and is the whole subject of the test. It stays on
 * until switched off rather than failing once, because several components read
 * the list and a one-shot failure would be papered over by the next reader.
 */
async function failConversationListReads(page: Page) {
  await page.addInitScript(() => {
    window.failConversationReads = true
    // Deliberately unbound: this replaces the prototype method, and the
    // replacement forwards the `this` it was called with.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const real = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: Parameters<IDBDatabase['transaction']>) {
      const [stores, mode] = args
      const names = Array.isArray(stores) ? stores : [stores]
      if (window.failConversationReads && mode !== 'readwrite' && names.includes('conversations')) {
        throw new DOMException('simulated storage failure', 'InvalidStateError')
      }
      return Reflect.apply(real, this, args)
    }
  })
}

test.describe('a conversation list that will not load', () => {
  test('offers a retry instead of claiming there is nothing stored', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Worth finding again')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)

    await failConversationListReads(page)
    await page.goto('/')

    // Nothing re-reads the list on its own: the store publishes on writes, and
    // there are none while the sidebar is empty. Reporting the failed read as
    // "No conversations yet." would strand the reader there for the session,
    // looking at what reads as a lost history.
    const alert = sidebar(page).getByRole('alert')
    await expect(alert).toContainText("Couldn't load your chats")
    await expect(sidebar(page).getByText('No conversations yet.')).toBeHidden()

    await page.evaluate(() => {
      window.failConversationReads = false
    })
    await alert.getByRole('button', { name: 'Try again' }).click()

    await expect(sidebar(page).getByText('Worth finding again')).toBeVisible()
    await expect(alert).toBeHidden()
  })

  test('does not name a conversation whose entry it could not read', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'A title that lives in storage')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const conversationUrl = page.url()

    await failConversationListReads(page)
    await page.goto(conversationUrl)

    await expect(sidebar(page).getByRole('alert')).toBeVisible()
    // The name is in the store and unreadable. "Untitled chat" would assert
    // something about this conversation that the app has no way to know, in the
    // heading and in the tab it names.
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Untitled chat')
    await expect(page).toHaveTitle('Pydantic AI')
  })
})
