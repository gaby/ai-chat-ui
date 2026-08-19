/**
 * Narrow a value that came from outside the type system — a parsed JSON body, a
 * message's `metadata` — to something whose properties can be read one at a
 * time. Says nothing about what those properties hold, so every read still has
 * to check.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
