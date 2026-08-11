import type { UIMessage } from 'ai'
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'

import { formatTokens, parseUsage } from '@/lib/usage'

/**
 * Per-reply usage, sitting with that turn's other actions. Renders nothing
 * unless the backend reported for this message: an estimate is meaningful for a
 * whole conversation but noise on a single line.
 */
export function MessageUsage({ message }: { message: UIMessage }) {
  const reported = parseUsage(message.metadata)
  if (!reported) return null

  // A backend may report only a total — the split is optional in the shape this
  // reads. Showing the breakdown then meant "↑ 0 ↓ 0" on a reply that cost 42
  // tokens, so the total stands in for it.
  if (reported.inputTokens === 0 && reported.outputTokens === 0) {
    return (
      <span className="text-muted-foreground px-2 text-xs tabular-nums" title="Total tokens for this reply">
        {formatTokens(reported.totalTokens)} tokens
      </span>
    )
  }

  return (
    <span
      className="text-muted-foreground flex items-center gap-2 px-2 text-xs tabular-nums"
      title={`${reported.inputTokens.toLocaleString()} input, ${reported.outputTokens.toLocaleString()} output`}
    >
      <span className="flex items-center gap-0.5">
        <ArrowUpIcon className="size-3" />
        {formatTokens(reported.inputTokens)}
      </span>
      <span className="flex items-center gap-0.5">
        <ArrowDownIcon className="size-3" />
        {formatTokens(reported.outputTokens)}
      </span>
    </span>
  )
}
