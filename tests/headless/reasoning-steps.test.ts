import { describe, expect, it } from 'vitest'

import { parseReasoningSteps } from '../../src/lib/reasoning-steps'

describe('parseReasoningSteps', () => {
  it('reads a bolded line as the step it heads', () => {
    const steps = parseReasoningSteps(
      '**Understanding the question**\nThe user wants X.\n\n**Weighing options**\nA beats B.',
    )

    expect(steps).toEqual([
      { title: 'Understanding the question', body: 'The user wants X.' },
      { title: 'Weighing options', body: 'A beats B.' },
    ])
  })

  it('reads markdown headings the same way', () => {
    expect(parseReasoningSteps('## Checking the sources\nTwo of them agree.')).toEqual([
      { title: 'Checking the sources', body: 'Two of them agree.' },
    ])
  })

  it('joins a heading with the paragraph that follows it', () => {
    // Models often emit the heading and its body as separate paragraphs.
    expect(parseReasoningSteps('**Step one**\n\nThe body arrives separately.')).toEqual([
      { title: 'Step one', body: 'The body arrives separately.' },
    ])
  })

  it('falls back to one step per paragraph when nothing is headed', () => {
    expect(parseReasoningSteps('First thought.\n\nSecond thought.')).toEqual([
      { body: 'First thought.' },
      { body: 'Second thought.' },
    ])
  })

  it('keeps a fenced code block whole even when it contains a blank line', () => {
    const steps = parseReasoningSteps('Let me compute:\n\n```python\nx = 1\n\ny = 2\n```\n\nSo it is 3.')

    expect(steps).toHaveLength(3)
    expect(steps[1].body).toBe('```python\nx = 1\n\ny = 2\n```')
  })

  it('does not treat a line with two bold spans as a heading', () => {
    // A greedy match captured `First** we consider **second` as the title.
    expect(parseReasoningSteps('**First** we consider **second**')).toEqual([
      { body: '**First** we consider **second**' },
    ])
  })

  it('ignores blank input', () => {
    expect(parseReasoningSteps('')).toEqual([])
    expect(parseReasoningSteps('\n\n  \n')).toEqual([])
  })
})
