import type { Locator, Page } from '@playwright/test'

export function toolCard(page: Page, toolName: string): Locator {
  return page.locator(`[data-tool-name="${toolName}"]`)
}

/**
 * Open a turn's activity block so its tool cards can be asserted on.
 *
 * Tool calls live inside the block, which folds itself a second after the run
 * finishes. `click()` waits for the "Show activity" control to exist, which it
 * only does once folded — so this is deterministic rather than racing the
 * timer, and opening it cancels the auto-collapse for good.
 *
 * Not needed while a run is in flight, or when a pending approval or a failed
 * call is holding the block open: there is no "Show activity" control then, and
 * this would wait for one that never appears.
 */
export async function showActivity(page: Page, index = 0): Promise<void> {
  await page.getByRole('button', { name: 'Show activity' }).nth(index).click()
}

/**
 * Wait past the moment a finished run's activity block folds itself away.
 *
 * A block that must stay open — a pending approval, a denial, a failure — has
 * nothing to wait for, so every assertion about it resolves on the first poll,
 * a moment after the run ends and long before the timer would have fired. Call
 * this first and the assertion is taken on the other side of the collapse, so
 * it fails if the hold is gone.
 */
export async function afterAutoCollapse(page: Page): Promise<void> {
  // Comfortably past `AUTO_COLLAPSE_DELAY` in `useStreamingDisclosure`.
  const deadline = Date.now() + 1500
  await page.waitForFunction((until) => Date.now() >= until, deadline)
}
