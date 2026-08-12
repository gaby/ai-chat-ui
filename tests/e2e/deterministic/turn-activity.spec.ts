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

  test('keeps a multi-step tool loop in one block', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'two-step', 'Look it up, then work it out')
    await expect(page.getByText('Both steps are done.')).toBeVisible()

    // Each round is its own model step, and the SDK marks the boundary with a
    // `step-start` part. Treated as content it split the loop across a block
    // per step — the very stacking the single block exists to prevent.
    await expect(page.getByTestId('turn-activity')).toHaveCount(1)
    await expect(page.getByTestId('turn-activity')).toContainText('get_weather, calculate')

    await showActivity(page)
    await expect(toolCard(page, 'get_weather')).toBeVisible()
    await expect(toolCard(page, 'calculate')).toBeVisible()
  })

  test('keeps a cited source from splitting the block', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'sourced-tools', 'Look it up and work it out')
    await expect(page.getByText('Looked it up and worked it out.')).toBeVisible()

    // The source lands between the two calls, where a provider that cites its
    // sources puts them. It renders in the strip above the turn rather than in
    // the message column, but as a part it still ended the activity run — one
    // block per tool call, around something invisible.
    await expect(page.getByTestId('turn-activity')).toHaveCount(1)
    await expect(page.getByTestId('turn-activity')).toContainText('get_weather, calculate')
    await expect(page.getByRole('button', { name: /source/i })).toBeVisible()

    await showActivity(page)
    await expect(toolCard(page, 'get_weather')).toBeVisible()
    await expect(toolCard(page, 'calculate')).toBeVisible()
  })

  test('only the block still being worked on reads as live', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'interleaved', 'Weather, then sums')

    // Prose between the two rounds ends the first block. While the second round
    // is still going, the first was handed the message's streaming flag too: it
    // sat there spinning "Working" and counting time it had stopped spending.
    await expect(page.getByText('Checked the weather. Now the sums:')).toBeVisible()
    const blocks = page.getByTestId('turn-activity')
    await expect(blocks).toHaveCount(2)

    // Sampled once, while the stop control says the reply is still streaming.
    // A retrying assertion would pass either way: it would keep re-reading until
    // the answer landed, by which point every block reports a duration.
    await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible()
    const finished = await blocks.first().innerText()
    expect(finished).not.toContain('Working')
    expect(finished).toMatch(/Worked for \d+s/)

    await expect(page.getByText('Both rounds are done.')).toBeVisible()
    await expect(blocks.nth(1)).toContainText(/Worked for \d+s/)
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

  test('counts the thinking that came before the first tool call', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'reasoning-tool', 'Think, then look it up')
    await expect(page.getByText('Thought about it, then looked it up.')).toBeVisible()

    // The fixture spends about 2.7s thinking before it calls anything. The
    // block used to mount only when the tool arrived, restarting its timer, so
    // a turn that thought for half a minute reported the tool's second or two.
    const label = await page.getByRole('button', { name: /activity/ }).innerText()
    expect(Number(/Worked for (\d+)s/.exec(label)?.[1])).toBeGreaterThanOrEqual(2)

    // The reasoning fold inside it keeps its own timer too — it is the same
    // element throughout, not one torn down and rebuilt when the tool arrived.
    expect(
      Number(/Thought for (\d+)s/.exec(await page.getByText(/Thought for \d+s/).innerText())?.[1]),
    ).toBeGreaterThanOrEqual(2)
  })

  test('a turn that only thinks keeps its own single line', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'reasoning', 'Think about this')
    await expect(page.getByText('Here is the considered answer.')).toBeVisible()

    // The block is mounted from the first thinking token — it has to be, or the
    // first tool call would remount it and restart its timer — but with nothing
    // to group it shows no line of its own. Only the reasoning fold is visible.
    await expect(page.getByRole('button', { name: /activity/ })).toHaveCount(0)
    await expect(page.getByText(/Thought for \d+s/)).toBeVisible()
  })
})
