import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('reasoning', () => {
  test('folds the thinking into one line and reopens it as steps', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'reasoning', 'Think about this carefully')

    await expect(page.getByText('Here is the considered answer.')).toBeVisible()

    // The trace folds itself away once the answer lands, leaving the summary
    // line as the way back in.
    const trigger = page.getByRole('button', { name: /Thought for/ })
    await expect(trigger).toBeVisible()
    await expect(page.getByText('Understanding the question')).toBeHidden()

    await trigger.click()

    // Reopened, the thinking reads as the steps the model took, not one block.
    await expect(page.getByText('Understanding the question')).toBeVisible()
    await expect(page.getByText('Weighing the options')).toBeVisible()
    await expect(page.getByText('Working through the question step by step.')).toBeVisible()
  })
})
