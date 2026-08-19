import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'
import { showActivity, toolCard } from '../tools'

test.describe('tool calls', () => {
  test('shows tool call UI with tool name', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'tool', 'What is the weather?')
    await showActivity(page)
    await expect(toolCard(page, 'get_weather')).toBeVisible()
  })

  test('shows completed status for tool call', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'tool', 'weather')
    await showActivity(page)
    const card = toolCard(page, 'get_weather')
    await expect(card.getByText('Completed')).toBeVisible()
  })

  test('shows final text after tool execution', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'tool', 'weather')
    await expect(page.getByText('Tool result')).toBeVisible()
  })
})
