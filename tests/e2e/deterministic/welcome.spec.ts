import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('welcome screen', () => {
  test('greets on an empty conversation and offers starting points', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
    await expect(page.getByRole('button', { name: /List your tools/ })).toBeVisible()
  })

  test('a suggestion pre-fills the composer without sending', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /List your tools/ }).click()

    const input = page.getByPlaceholder('What would you like to know?')
    await expect(input).toHaveValue(/What tools do you have access to/)
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeVisible()
  })

  test('typing continues an open-ended suggestion picked over a draft', async ({ page }) => {
    await page.goto('/')

    const input = page.getByPlaceholder('What would you like to know?')
    await input.fill('hi')

    // The caret used to be moved before the controlled value had been committed,
    // so the browser clamped it to the old draft's length — two characters in,
    // and the next keystroke landed there instead of at the end.
    await page.getByRole('button', { name: /Explain a concept/ }).click()
    await input.pressSequentially('recursion works')

    await expect(input).toHaveValue('Explain how recursion works')
  })

  test('gives way to the conversation once a message is sent', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'text', 'Hello')

    await expect(page.getByText('Hello from the test server')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'How can I help?' })).toBeHidden()
  })
})
