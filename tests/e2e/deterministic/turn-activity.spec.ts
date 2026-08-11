import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { showActivity, toolCard } from '../tools'

test.describe('turn activity', () => {
  test('folds a turn`s tool calls into one line that still names them', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'multi-tool', 'Do both')
    await expect(page.getByText('All tools completed successfully.')).toBeVisible()

    // Once the answer lands the work folds away, so the reply is not pushed
    // down the page by a stack of cards — but the line still says what ran.
    const activity = page.getByTestId('turn-activity')
    await expect(activity).toContainText('get_weather, calculate')
    await expect(toolCard(page, 'get_weather')).toBeHidden()

    await showActivity(page)
    await expect(toolCard(page, 'get_weather')).toBeVisible()
    await expect(toolCard(page, 'calculate')).toBeVisible()
  })

  test('holds itself open while an approval is pending', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    // A decision to make is not something to fold away: the prompt stays on
    // screen, and there is no "Show activity" control because nothing is hidden.
    await expect(page.getByTestId('turn-activity')).toContainText('Waiting for your approval')
    await expect(page.getByText('This tool requires your approval to run')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show activity' })).toHaveCount(0)
  })

  test('holds itself open when a call failed', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'error', 'What is the weather?')
    await expect(page.getByText('The tool encountered an error.')).toBeVisible()

    await expect(page.getByTestId('turn-activity')).toContainText('Ran into a problem')
    await expect(toolCard(page, 'get_weather')).toBeVisible()
  })

  test('a turn that only thinks keeps its own single line', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'reasoning', 'Think about this')
    await expect(page.getByText('Here is the considered answer.')).toBeVisible()

    // Nothing to group, so the reasoning line is not wrapped in a second
    // fold that would say the same thing one level up.
    await expect(page.getByTestId('turn-activity')).toHaveCount(0)
    await expect(page.getByText(/Thought for \d+s/)).toBeVisible()
  })
})
