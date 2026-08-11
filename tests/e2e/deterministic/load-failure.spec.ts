import { test, expect } from '@playwright/test'
import { chat, sendMessage, waitForPersisted } from '../conversation'

declare global {
  interface Window {
    failHistoryReads?: boolean
  }
}

/**
 * Make reads of the messages store fail until the test says otherwise.
 *
 * Not a network mock — the ban in `tests/CLAUDE.md` is about faking the SSE wire
 * protocol, which drifts. This fakes browser storage misbehaving, which has no
 * other way to be provoked and is the whole subject of the test. It stays on
 * until switched off rather than failing once, because React's development
 * StrictMode runs the load effect twice and a one-shot failure would be papered
 * over by the second attempt.
 */
async function failHistoryReads(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.failHistoryReads = true
    // Deliberately unbound: this replaces the prototype method, and the
    // replacement forwards the `this` it was called with.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const real = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: unknown[]) {
      const [stores, mode] = args as [string | string[], IDBTransactionMode | undefined]
      const names = Array.isArray(stores) ? stores : [stores]
      if (window.failHistoryReads && mode !== 'readwrite' && names.includes('messages')) {
        throw new DOMException('simulated storage failure', 'InvalidStateError')
      }
      return Reflect.apply(real, this, args) as IDBTransaction
    }
  })
}

test.describe('a conversation that will not load', () => {
  test('refuses to send over the history it could not read, and offers a retry', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'History worth keeping')
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await waitForPersisted(page)
    const conversationUrl = page.url()

    await failHistoryReads(page)
    await page.goto(conversationUrl)

    // The read failed, so the transcript is empty — but the messages are still
    // in storage. Sending now would save the new turn over them, so it is
    // blocked rather than quietly destroying a history that only failed to read.
    const alert = page.getByRole('alert')
    await expect(alert).toContainText("Couldn't open this conversation")
    await page.getByPlaceholder('What would you like to know?').fill('this must not be sent')
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()

    await page.evaluate(() => {
      window.failHistoryReads = false
    })
    await alert.getByRole('button', { name: 'Try again' }).click()

    // Second read succeeds: the history comes back untouched and sending resumes.
    await expect(chat(page).getByText('History worth keeping')).toBeVisible()
    await expect(chat(page).getByText('Hello from the test server')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled()
  })
})
