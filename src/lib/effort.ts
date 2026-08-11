import { THINKING_EFFORT_LEVELS, type ThinkingEffort } from '@/lib/generated/thinking-effort.gen'

const STORAGE_KEY = 'effort'
const DEFAULT_EFFORT: ThinkingEffort = 'medium'

export function isThinkingEffort(value: string): value is ThinkingEffort {
  return (THINKING_EFFORT_LEVELS as readonly string[]).includes(value)
}

/**
 * Read the stored thinking effort, clamped to a level that still exists.
 *
 * The levels are generated from pydantic-ai and drift with it, so a stored
 * value can outlive its level. Clamping on read keeps what the meter displays
 * and what the request body carries from diverging — an unrecognised value used
 * to render as "Medium" while the stale string kept going out on the wire.
 */
export function readEffort(): ThinkingEffort {
  const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  // Empty string was the old "Default" sentinel; it clamps to the default too.
  return stored !== null && isThinkingEffort(stored) ? stored : DEFAULT_EFFORT
}

export function writeEffort(effort: ThinkingEffort): void {
  localStorage.setItem(STORAGE_KEY, effort)
}
