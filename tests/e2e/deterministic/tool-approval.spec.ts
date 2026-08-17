import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { afterAutoCollapse, toolCard } from '../tools'

test.describe('tool approval', () => {
  test('approve runs the tool and shows the result', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const card = toolCard(page, 'send_email')
    // ToolPart auto-opens on approval-requested, so the prompt should be
    // visible without needing to expand the card manually.
    await expect(card.getByText('Approval Required')).toBeVisible()
    await expect(card.getByText('This tool requires your approval to run')).toBeVisible()
    // The prompt names the tool it is asking about and says nothing has run.
    await expect(card.getByText('has not run yet')).toBeVisible()
    await expect(card.getByRole('heading', { name: 'Arguments' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Approve' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Deny' })).toBeVisible()

    await card.getByRole('button', { name: 'Approve' }).click()

    await expect(card.getByText('Approved by you.')).toBeVisible()
    await expect(card.getByText('Completed')).toBeVisible()
    await expect(page.getByText('The email has been sent successfully.')).toBeVisible()
  })

  test('answering an approval does not add a second assistant turn', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval-slow', 'Send an email')

    const card = toolCard(page, 'send_email')
    await expect(card.getByRole('button', { name: 'Approve' })).toBeVisible()
    await card.getByRole('button', { name: 'Approve' }).click()

    // The continuation is `submitted` until its first chunk, and the fixture
    // takes a couple of seconds to send one. The turn is already on screen and
    // already showing its own live activity, so the standalone placeholder
    // would be a second avatar and a second "Thinking" beneath it. Sampled
    // once while the run is in flight: a retrying count would pass either way.
    await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible()
    expect(await page.getByText('Thinking', { exact: true }).count()).toBe(0)

    await expect(page.getByText('The email has been sent successfully.')).toBeVisible()
  })

  test('keeps the record of the decision when the approved tool fails', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval-error', 'Delete the archive rows')

    const card = toolCard(page, 'delete_records')
    await expect(card.getByText('This tool requires your approval to run')).toBeVisible()

    await card.getByRole('button', { name: 'Approve' }).click()

    await expect(card.getByRole('heading', { name: 'Error' })).toBeVisible()
    await expect(card.getByText("Table 'archive' is locked").first()).toBeVisible()
    // The failure does not erase who let the call through.
    await expect(card.getByText('Approved by you.')).toBeVisible()
  })

  test('deny shows the rejected state and does not execute the tool', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval', 'Send an email')

    const card = toolCard(page, 'send_email')
    await expect(card.getByText('Approval Required')).toBeVisible()

    await card.getByRole('button', { name: 'Deny' }).click()

    await expect(card.getByText('Denied. Tool will not run.')).toBeVisible()
    await expect(page.getByText('The email was not sent because you denied the request.')).toBeVisible()

    // Taken on the far side of the collapse the turn would otherwise have done:
    // a decision the user made is a record to keep, and the summary line has to
    // say so rather than reporting the turn as a run that simply finished.
    await afterAutoCollapse(page)
    await expect(card.getByText('Denied. Tool will not run.')).toBeVisible()
    await expect(page.getByTestId('turn-activity')).toContainText('Denied · send_email')
  })

  test('a run stopped after the approval keeps the unanswered call on screen', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'approval-slow', 'Send an email')

    const card = toolCard(page, 'send_email')
    await card.getByRole('button', { name: 'Approve' }).click()

    // The continuation takes a moment to say anything, so there is a window in
    // which the call has been let through but has not run. Stopping there ends
    // the turn with the call unanswered — the state `Chat.tsx` has to prune
    // before the next message, and the card is the only account of it.
    await page.getByRole('button', { name: 'Stop generating' }).click()

    await afterAutoCollapse(page)
    await expect(card).toBeVisible()
    await expect(page.getByTestId('turn-activity')).toContainText('Stopped before finishing · send_email')
  })
})
