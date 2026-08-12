import { test, expect } from '@playwright/test'
import { sidebar } from '../sidebar'

declare global {
  interface Window {
    conversationEvents?: number
  }
}

/**
 * Seed a pre-IndexedDB history, and make one write fail partway through it.
 *
 * Not a network mock — the ban in `tests/CLAUDE.md` is about faking the SSE wire
 * protocol, which drifts. This fakes browser storage misbehaving, which has no
 * other way to be provoked and is the whole subject of the test.
 */
async function seedLegacyHistory(page: import('@playwright/test').Page, { failSecondWrite = false } = {}) {
  await page.addInitScript(
    ({ fail }: { fail: boolean }) => {
      window.conversationEvents = 0
      window.addEventListener('conversations-changed', () => {
        window.conversationEvents = (window.conversationEvents ?? 0) + 1
      })

      const message = (text: string) => [{ id: 'm1', role: 'user', parts: [{ type: 'text', text }] }]
      localStorage.setItem(
        'conversationIds',
        JSON.stringify([
          { id: 'legacy-a', firstMessage: 'Legacy first', timestamp: Date.now() - 60_000 },
          { id: 'legacy-b', firstMessage: 'Legacy second', timestamp: Date.now() },
        ]),
      )
      localStorage.setItem('legacy-a', JSON.stringify(message('Legacy first')))
      localStorage.setItem('legacy-b', JSON.stringify(message('Legacy second')))

      if (!fail) return
      let writes = 0
      // Deliberately unbound: this replaces the prototype method, and the
      // replacement forwards the `this` it was called with.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const real = IDBDatabase.prototype.transaction
      IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: unknown[]) {
        const [stores, mode] = args as [string | string[], IDBTransactionMode | undefined]
        const names = Array.isArray(stores) ? stores : [stores]
        // The second conversation's history: the first one is already in the
        // store by then, which is the state the sidebar has to catch up with.
        if (mode === 'readwrite' && names.includes('messages') && ++writes === 2) {
          throw new DOMException('simulated storage failure', 'InvalidStateError')
        }
        return Reflect.apply(real, this, args) as IDBTransaction
      }
    },
    { fail: failSecondWrite },
  )
}

test.describe('localStorage migration', () => {
  test('moves an old history into the sidebar', async ({ page }) => {
    await seedLegacyHistory(page)
    await page.goto('/')

    await expect(sidebar(page).getByText('Legacy first')).toBeVisible()
    await expect(sidebar(page).getByText('Legacy second')).toBeVisible()
  })

  test('shows what was migrated even when the batch aborts', async ({ page }) => {
    await seedLegacyHistory(page, { failSecondWrite: true })
    await page.goto('/')

    await expect(page.getByText(/Failed to save messages/)).toBeVisible()
    await expect(sidebar(page).getByText('Legacy first')).toBeVisible()

    // Asserted on the event rather than on the row, because whether the sidebar
    // has already read the store by this point is a race it wins more often than
    // not. The invariant is the one the batch owes its readers: per-entry events
    // are suppressed so N conversations do not cost N growing re-reads, and a
    // batch that threw used to end with no event at all — leaving whatever did
    // land invisible to any reader that had already read, until some later write
    // happened to notify.
    expect(await page.evaluate(() => window.conversationEvents ?? 0)).toBeGreaterThan(0)
  })
})
