const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Midnight (local time) of the day `timestamp` falls in. */
function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * Short, human relative time for a conversation entry: `Just now`, `12m`,
 * `3h`, `Yesterday`, then a calendar date once it is older than a week.
 */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const elapsed = now - timestamp
  if (elapsed < MINUTE) return 'Just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`

  const dayDelta = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY)
  if (dayDelta === 0) return `${Math.floor(elapsed / HOUR)}h ago`
  if (dayDelta === 1) return 'Yesterday'
  if (dayDelta < 7) return `${dayDelta}d ago`

  const date = new Date(timestamp)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

// Constructing an Intl formatter is expensive and these run per sidebar row on
// every render; build each one once.
const absoluteFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Full timestamp, for the tooltip behind the relative label. */
export function absoluteTime(timestamp: number): string {
  return absoluteFormatter.format(timestamp)
}

/**
 * Bucket label used to group the conversation list. Buckets are contiguous and
 * ordered, so grouping a timestamp-sorted list keeps the list sorted.
 */
export function dateGroupLabel(timestamp: number, now = Date.now()): string {
  const dayDelta = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY)
  if (dayDelta <= 0) return 'Today'
  if (dayDelta === 1) return 'Yesterday'
  if (dayDelta < 7) return 'Previous 7 days'
  if (dayDelta < 30) return 'Previous 30 days'
  return 'Older'
}

export interface DateGroup<T> {
  label: string
  items: T[]
}

/** Group already-sorted (newest first) entries into contiguous date buckets. */
export function groupByDate<T>(items: T[], getTimestamp: (item: T) => number, now = Date.now()): DateGroup<T>[] {
  const groups: DateGroup<T>[] = []
  for (const item of items) {
    const label = dateGroupLabel(getTimestamp(item), now)
    const last = groups.at(-1)
    if (last?.label === label) {
      last.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }
  return groups
}
