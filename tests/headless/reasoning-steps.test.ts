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

  it('closes a fence only on a matching delimiter', () => {
    // A ````-fenced block wrapping a ``` example: toggling on any fence-looking
    // line closed the outer block at the inner opener, and the blank lines that
    // followed then tore the code across three steps.
    const steps = parseReasoningSteps(
      'Here is the file:\n\n````markdown\n```python\nx = 1\n\ny = 2\n```\n````\n\nThat is all.',
    )

    expect(steps).toHaveLength(3)
    expect(steps[1].body).toBe('````markdown\n```python\nx = 1\n\ny = 2\n```\n````')
    expect(steps[2].body).toBe('That is all.')
  })

  it('does not close a fence on a line that carries more than the delimiter', () => {
    // An opening fence may carry an info string; a closing one may not. Matching
    // the delimiter alone let ```` ```not-a-close ```` end the block, and the
    // blank line after it then split the code in two.
    const steps = parseReasoningSteps('Look:\n\n```\n```not-a-close\n\nx = 1\n```\n\nDone.')

    expect(steps).toHaveLength(3)
    expect(steps[1].body).toBe('```\n```not-a-close\n\nx = 1\n```')
  })

  it('does not close a backtick fence on a tilde line', () => {
    const steps = parseReasoningSteps('Compute:\n\n```python\n~~~\n\nx = 1\n```\n\nDone.')

    expect(steps).toHaveLength(3)
    expect(steps[1].body).toBe('```python\n~~~\n\nx = 1\n```')
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
