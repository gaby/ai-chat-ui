import { test, expect } from '@playwright/test'
import { sendMessage } from '../conversation'

test.describe('markdown rendering', () => {
  test('typesets math instead of printing its source next to it', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'markdown', 'Show me some markdown')

    // Typeset as MathML, which the browser lays out natively.
    const math = page.locator('math')
    await expect(math).toBeVisible()
    await expect(math).toHaveAttribute('display', 'block')

    // The regression this guards: KaTeX also emits the LaTeX source and, before
    // the elements carrying it were allowed through sanitisation, both it and a
    // second unstyled rendering showed up as text — `$$E = mc^2$$` read as
    // "E=mc2E = mc^2E=mc2".
    // The source is still in the document — MathML keeps it for assistive tech
    // and copy-paste — but it must not be laid out.
    await expect(page.getByText('mc^2')).toBeHidden()
    await expect(page.getByText('E=mc2', { exact: true })).toBeVisible()
  })

  test('keeps links and inline code intact', async ({ page }) => {
    await page.goto('/')
    await sendMessage(page, 'markdown', 'Show me some markdown')

    // Sanitisation runs over model output; these are the attributes it has to
    // let through for a reply to be readable at all.
    await expect(page.getByRole('link', { name: 'link to the docs' })).toHaveAttribute(
      'href',
      'https://ai.pydantic.dev/',
    )
    await expect(page.getByText('inline code')).toBeVisible()
  })
})
