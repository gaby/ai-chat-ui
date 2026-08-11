import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('reasoning', () => {
  test('summarises the thinking and keeps it reachable next to the answer', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'reasoning', 'Think about this carefully')

    await expect(page.getByText('Here is the considered answer.')).toBeVisible()

    // The reasoning block folds itself away shortly after the run ends so the
    // answer is what is left on screen; the summary line stays as the way back in.
    const trigger = page.getByRole('button', { name: /Thought for|Thinking/ })
    await expect(trigger).toBeVisible()
    await expect(page.getByText('Working through the question')).toBeHidden()

    await trigger.click()
    await expect(page.getByText('Working through the question')).toBeVisible()
  })
})
