import { describe, expect, it } from 'vitest'

import { conversationTitle } from '../../src/lib/conversation-title'
import { dateGroupLabel, groupByDate, relativeTime } from '../../src/lib/format-time'
import { summarizeToolInput } from '../../src/lib/tool-summary'

// Fixed reference point so the buckets are deterministic: 2026-03-15 12:00 local.
const NOW = new Date(2026, 2, 15, 12, 0, 0).getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('relativeTime', () => {
  it('reads as recency, not as a timestamp', () => {
    expect(relativeTime(NOW - 10_000, NOW)).toBe('Just now')
    expect(relativeTime(NOW - 12 * MINUTE, NOW)).toBe('12m ago')
    expect(relativeTime(NOW - 3 * HOUR, NOW)).toBe('3h ago')
  })

  it('names the previous day rather than counting hours across midnight', () => {
    // 14 hours earlier is still "yesterday" in local terms, not "14h ago".
    expect(relativeTime(NOW - 14 * HOUR, NOW)).toBe('Yesterday')
    expect(relativeTime(NOW - 3 * DAY, NOW)).toBe('3d ago')
  })

  it('falls back to a calendar date beyond a week', () => {
    const older = NOW - 10 * DAY
    // Compared against the platform's own formatting rather than an English
    // string, so the test does not depend on the runtime's default locale.
    expect(relativeTime(older, NOW)).toBe(
      new Date(older).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    )
  })
})

describe('dateGroupLabel', () => {
  it('buckets by calendar distance', () => {
    expect(dateGroupLabel(NOW, NOW)).toBe('Today')
    expect(dateGroupLabel(NOW - 14 * HOUR, NOW)).toBe('Yesterday')
    expect(dateGroupLabel(NOW - 4 * DAY, NOW)).toBe('Previous 7 days')
    expect(dateGroupLabel(NOW - 20 * DAY, NOW)).toBe('Previous 30 days')
    expect(dateGroupLabel(NOW - 200 * DAY, NOW)).toBe('Older')
  })
})

describe('groupByDate', () => {
  it('keeps a newest-first list in order and merges runs of the same bucket', () => {
    const entries = [NOW - MINUTE, NOW - 2 * HOUR, NOW - 14 * HOUR, NOW - 4 * DAY, NOW - 5 * DAY]
    const groups = groupByDate(
      entries.map((timestamp) => ({ timestamp })),
      (entry) => entry.timestamp,
      NOW,
    )

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday', 'Previous 7 days'])
    expect(groups.map((group) => group.items.length)).toEqual([2, 1, 2])
  })
})

describe('summarizeToolInput', () => {
  it('previews the arguments of a tool call on one line', () => {
    expect(summarizeToolInput({ city: 'London' })).toBe('city: London')
    expect(summarizeToolInput({ code: 'print(1)', restart: false })).toBe('code: print(1), restart: false')
  })

  it('skips values that cannot be shown inline', () => {
    expect(summarizeToolInput({ nested: { a: 1 }, city: 'Paris' })).toBe('city: Paris')
    expect(summarizeToolInput({ items: [1, 2, 3] })).toBe('items: [3]')
    expect(summarizeToolInput({})).toBeNull()
    expect(summarizeToolInput(null)).toBeNull()
  })

  it('collapses whitespace and truncates so the header stays one line', () => {
    expect(summarizeToolInput({ q: 'a\n  b' })).toBe('q: a b')
    const long = summarizeToolInput({ q: 'x'.repeat(200) })
    expect(long).not.toBeNull()
    expect(long!.length).toBeLessThanOrEqual(80)
  })
})

describe('conversationTitle', () => {
  it('prefers the name the user gave it', () => {
    expect(conversationTitle({ title: 'Weather research', firstMessage: 'what is the weather' })).toBe(
      'Weather research',
    )
  })

  it('treats a blank name or first message as absent', () => {
    // `??` let these through, leaving every surface rendering an empty string.
    expect(conversationTitle({ firstMessage: '' })).toBe('Untitled chat')
    expect(conversationTitle({ firstMessage: '   ' })).toBe('Untitled chat')
    expect(conversationTitle({ title: '  ', firstMessage: 'the opening line' })).toBe('the opening line')
    expect(conversationTitle(undefined)).toBe('Untitled chat')
  })
})
