import type { UIMessage } from 'ai'
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'

import { conversationUsage, formatTokens } from '@/lib/usage'

/**
 * Per-reply usage, sitting with that turn's other actions. Renders nothing
 * unless the backend reported for this message: an estimate is meaningful for a
 * whole conversation but noise on a single line.
 */
export function MessageUsage({ message }: { message: UIMessage }) {
  const { reported } = conversationUsage([message])
  if (!reported) return null

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
