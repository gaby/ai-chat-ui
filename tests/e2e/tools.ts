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
