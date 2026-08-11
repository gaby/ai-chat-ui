const MAX_SUMMARY_LENGTH = 72
const MAX_VALUE_LENGTH = 40

function formatValue(value: unknown): string | null {
  if (typeof value === 'string') {
    // Cut first, then collapse: a 50KB `code` argument does not need a full
    // regex scan and a full copy to yield 40 visible characters.
    const collapsed = value
      .slice(0, MAX_VALUE_LENGTH * 2 + 1)
      .replace(/\s+/g, ' ')
      .trim()
    if (collapsed === '') return null
    return collapsed.length > MAX_VALUE_LENGTH ? collapsed.slice(0, MAX_VALUE_LENGTH) + '…' : collapsed
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.length}]`
  return null
}

/**
 * A one-line preview of a tool call's arguments, shown next to the tool name.
 *
 * A collapsed card that says only `get_weather` forces a click to learn
 * anything; `get_weather · city: London` makes a run of tool calls readable at
 * a glance. Nested objects are skipped rather than flattened — they never fit
 * on one line, and the expanded card already shows them in full.
 */
export function summarizeToolInput(input: unknown): string | null {
  if (typeof input === 'string') return formatValue(input)
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null

  const parts: string[] = []
  for (const [key, value] of Object.entries(input)) {
    const formatted = formatValue(value)
    if (formatted === null) continue
    parts.push(`${key}: ${formatted}`)
    if (parts.join(', ').length >= MAX_SUMMARY_LENGTH) break
  }

  if (parts.length === 0) return null
  const summary = parts.join(', ')
  return summary.length > MAX_SUMMARY_LENGTH ? summary.slice(0, MAX_SUMMARY_LENGTH) + '…' : summary
}
