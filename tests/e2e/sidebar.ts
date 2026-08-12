import type { Locator, Page } from '@playwright/test'

export function sidebar(page: Page): Locator {
  return page.locator('[data-slot="sidebar"]')
}

/**
 * Open a conversation row's menu and pick an item.
 *
 * `force` because the trigger is `opacity-0` until its row is hovered, and the
 * accessible name is built in `conversation-menu.tsx` — both were copied into
 * every spec that deletes, renames or pins, so changing either meant editing a
 * dozen call sites.
 */
export async function conversationAction(page: Page, title: string, action: 'Delete' | 'Rename' | 'Pin' | 'Unpin') {
  await sidebar(page)
    .getByRole('button', { name: `Conversation options: ${title}` })
    .click({ force: true })
  await page.getByRole('menuitem', { name: action }).click()
}
