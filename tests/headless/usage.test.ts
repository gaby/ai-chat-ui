import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import { conversationUsage, estimateTokens, formatTokens, parseUsage } from '../../src/lib/usage'

function assistant(text: string, metadata?: unknown): UIMessage {
  return { id: text, role: 'assistant', parts: [{ type: 'text', text }], metadata } as UIMessage
}

function user(text: string): UIMessage {
  return { id: text, role: 'user', parts: [{ type: 'text', text }] } as UIMessage
}

describe('parseUsage', () => {
  it('reads the camelCase shape a backend attaches to message metadata', () => {
    const usage = parseUsage({ usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150, requests: 2 } })

    expect(usage).toMatchObject({ inputTokens: 120, outputTokens: 30, totalTokens: 150, requests: 2 })
  })

  it('accepts snake_case, since Python backends emit either', () => {
    const usage = parseUsage({ usage: { input_tokens: 10, output_tokens: 4, cache_read_tokens: 6 } })

    expect(usage).toMatchObject({ inputTokens: 10, outputTokens: 4, cacheReadTokens: 6 })
  })

  it('derives the total when the backend omits it', () => {
    expect(parseUsage({ usage: { inputTokens: 10, outputTokens: 4 } })?.totalTokens).toBe(14)
  })

  it('treats missing or empty usage as absent rather than zero', () => {
    expect(parseUsage(undefined)).toBeNull()
    expect(parseUsage({})).toBeNull()
    expect(parseUsage({ usage: {} })).toBeNull()
    expect(parseUsage({ usage: { inputTokens: 0, outputTokens: 0 } })).toBeNull()
  })
})

describe('conversationUsage', () => {
  it('sums the turns that reported, and says how many did', () => {
    const messages = [
      user('hi'),
      assistant('one', { usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110, requests: 1 } }),
      user('again'),
      assistant('two', { usage: { inputTokens: 200, outputTokens: 20, totalTokens: 220, requests: 2 } }),
    ]

    const { reported, reportedTurns, assistantTurns } = conversationUsage(messages)

    expect(reported).toMatchObject({ inputTokens: 300, outputTokens: 30, totalTokens: 330, requests: 3 })
    expect(reportedTurns).toBe(2)
    expect(assistantTurns).toBe(2)
  })

  it('flags a partially-reported conversation', () => {
    const messages = [assistant('reported', { usage: { totalTokens: 42 } }), assistant('silent')]

    const { reportedTurns, assistantTurns } = conversationUsage(messages)

    expect(reportedTurns).toBe(1)
    expect(assistantTurns).toBe(2)
  })

  it('skips the estimate when the backend reported', () => {
    // The estimate walks every tool payload; computing it to throw it away is
    // what made typing lag on long conversations.
    const { estimatedTokens } = conversationUsage([assistant('x'.repeat(400), { usage: { totalTokens: 42 } })])

    expect(estimatedTokens).toBe(0)
  })

  it('falls back to an estimate when nothing reported', () => {
    const { reported, estimatedTokens } = conversationUsage([user('a'.repeat(40)), assistant('b'.repeat(40))])

    expect(reported).toBeNull()
    expect(estimatedTokens).toBe(20)
  })
})

describe('estimateTokens', () => {
  it('counts tool arguments and results, not just prose', () => {
    const withTool = {
      id: 'tool',
      role: 'assistant',
      parts: [{ type: 'tool-get_weather', toolCallId: '1', state: 'output-available', input: { city: 'London' } }],
    } as unknown as UIMessage

    expect(estimateTokens([withTool])).toBeGreaterThan(0)
  })
})

describe('formatTokens', () => {
  it('stays exact below a thousand and compacts above it', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(842)).toBe('842')
    expect(formatTokens(1200)).toBe('1.2k')
    expect(formatTokens(12_400)).toBe('12k')
    expect(formatTokens(1_300_000)).toBe('1.3M')
  })

  it('carries into the next unit rather than rendering 1000k', () => {
    expect(formatTokens(999_999)).toBe('1.0M')
    expect(formatTokens(9_999)).toBe('10k')
  })

  it('does not render a non-finite count', () => {
    expect(formatTokens(Number.NaN)).toBe('0')
  })
})
