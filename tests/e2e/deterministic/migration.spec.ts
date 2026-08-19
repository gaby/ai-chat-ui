import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { conversationAction, sidebar } from '../sidebar'

declare global {
  interface Window {
    conversationEvents?: number
  }
}

/** What browser storage should do wrong, if anything. */
type Fault = 'none' | 'fail-second-write' | 'abort-commit'

// The seed script runs on every navigation, so it records that it has run:
// writing the legacy keys back on a reload would hand a later migration entries
// it had already moved across, which is the state these tests exist to rule
// out. The fault is stored the same way, so a test can let storage start
// working again and reload into a replay.
const SEEDED_KEY = 'e2e-legacy-seeded'
const FAULT_KEY = 'e2e-storage-fault'

/**
 * Seed a pre-IndexedDB history, and optionally make browser storage misbehave.
 *
 * Not a network mock — the ban in `tests/CLAUDE.md` is about faking the SSE wire
 * protocol, which drifts. This fakes browser storage misbehaving, which has no
 * other way to be provoked and is the whole subject of the test.
 */
async function seedLegacyHistory(page: Page, { fault = 'none' }: { fault?: Fault } = {}) {
  await page.addInitScript(
    ({ fault, seededKey, faultKey }: { fault: Fault; seededKey: string; faultKey: string }) => {
      window.conversationEvents = 0
      window.addEventListener('conversations-changed', () => {
        window.conversationEvents = (window.conversationEvents ?? 0) + 1
      })

      if (!localStorage.getItem(seededKey)) {
        localStorage.setItem(seededKey, 'true')
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
        if (fault !== 'none') localStorage.setItem(faultKey, fault)
      }

      const active = localStorage.getItem(faultKey)

      if (active === 'fail-second-write') {
        let writes = 0
        // Deliberately unbound: this replaces the prototype method, and the
        // replacement forwards the `this` it was called with.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const real = IDBDatabase.prototype.transaction
        IDBDatabase.prototype.transaction = function (
          this: IDBDatabase,
          ...args: Parameters<IDBDatabase['transaction']>
        ) {
          const [stores, mode] = args
          const names = Array.isArray(stores) ? stores : [stores]
          // The second conversation's history: the first one is already in the
          // store by then, which is the state the sidebar has to catch up with.
          if (mode === 'readwrite' && names.includes('messages') && ++writes === 2) {
            throw new DOMException('simulated storage failure', 'InvalidStateError')
          }
          return Reflect.apply(real, this, args)
        }
      }

      if (active === 'abort-commit') {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const realPut = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
          const request = Reflect.apply(realPut, this, args)
          if (this.name === 'messages') {
            // The shape of a commit-time failure — quota exceeded, disk error,
            // a connection closed under the transaction: every request reports
            // success, and the transaction aborts afterwards with nothing
            // stored.
            request.addEventListener('success', () => {
              this.transaction.abort()
            })
          }
          return request
        }
      }
    },
    { fault, seededKey: SEEDED_KEY, faultKey: FAULT_KEY },
  )
}

/** Let browser storage work again, for the next load. */
async function healStorage(page: Page) {
  await page.evaluate((key: string) => {
    localStorage.removeItem(key)
  }, FAULT_KEY)
}

test.describe('localStorage migration', () => {
  test('moves an old history into the sidebar', async ({ page }) => {
    await seedLegacyHistory(page)
    await page.goto('/')

    await expect(sidebar(page).getByText('Legacy first')).toBeVisible()
    await expect(sidebar(page).getByText('Legacy second')).toBeVisible()
  })

  test('shows what was migrated even when the batch aborts', async ({ page }) => {
    await seedLegacyHistory(page, { fault: 'fail-second-write' })
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

  test('keeps a rename made after a batch aborted, and finishes the rest', async ({ page }) => {
    await seedLegacyHistory(page, { fault: 'fail-second-write' })
    await page.goto('/')
    await expect(page.getByText(/Failed to save messages/)).toBeVisible()
    await expect(sidebar(page).getByText('Legacy first')).toBeVisible()

    await conversationAction(page, 'Legacy first', 'Rename')
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Conversation name').fill('Renamed since the migration')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(sidebar(page).getByText('Renamed since the migration')).toBeVisible()

    await healStorage(page)
    await page.goto('/')

    // A batch that fails leaves the completion flag unset, so this load runs the
    // migration again. It has to finish what failed without handing back the
    // legacy title of a conversation the user has renamed since.
    await expect(sidebar(page).getByText('Legacy second')).toBeVisible()
    await expect(sidebar(page).getByText('Renamed since the migration')).toBeVisible()
    await expect(sidebar(page).getByText('Legacy first')).toBeHidden()
  })

  test('does not bring back a conversation deleted after a batch aborted', async ({ page }) => {
    await seedLegacyHistory(page, { fault: 'fail-second-write' })
    await page.goto('/')
    await expect(page.getByText(/Failed to save messages/)).toBeVisible()
    await expect(sidebar(page).getByText('Legacy first')).toBeVisible()

    await conversationAction(page, 'Legacy first', 'Delete')
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Chat deleted successfully')).toBeVisible()

    await healStorage(page)
    await page.goto('/')

    // "Cannot be undone" has to survive the replay. Nothing in storage tells a
    // conversation deleted after it was migrated apart from one that never made
    // it across, so a migration that offered the whole legacy list again would
    // put this one back.
    await expect(sidebar(page).getByText('Legacy second')).toBeVisible()
    await expect(sidebar(page).getByText('Legacy first')).toBeHidden()
  })

  test('keeps the localStorage copy when a write only looks like it succeeded', async ({ page }) => {
    await seedLegacyHistory(page, { fault: 'abort-commit' })
    await page.goto('/')

    await expect(page.getByText(/Failed to save messages/)).toBeVisible()

    // The put reported success and the transaction aborted afterwards, so
    // nothing was stored. localStorage still holds the only copy of this
    // history, and clearing it on the strength of a request-level `success`
    // cannot be undone.
    const legacy = await page.evaluate(() => ({
      messages: localStorage.getItem('legacy-a'),
      list: localStorage.getItem('conversationIds'),
      complete: localStorage.getItem('indexeddb-migration-complete'),
    }))
    expect(legacy.messages).not.toBeNull()
    expect(legacy.list).toContain('legacy-a')
    expect(legacy.complete).toBeNull()
  })
})
