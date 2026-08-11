import type { UIMessage } from 'ai'
import { GaugeIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { conversationUsage, formatTokens } from '@/lib/usage'

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1 text-sm">
      <span className="text-muted-foreground flex items-center gap-1.5">{label}</span>
      <span className="font-mono tabular-nums">
        {value}
        {hint && <span className="text-muted-foreground ml-1 text-xs">{hint}</span>}
      </span>
    </div>
  )
}

/**
 * Running token cost of the conversation, with the breakdown behind a click.
 *
 * Exact numbers come from the backend (`UIMessage.metadata.usage`). Agents that
 * do not report usage still get a number, derived from the message text and
 * marked approximate — a wrong-looking exact figure would be worse than an
 * honestly-labelled estimate.
 */
export function UsageSummary({ messages }: { messages: UIMessage[] }) {
  const { reported, reportedTurns, assistantTurns, estimatedTokens } = conversationUsage(messages)
  const isEstimate = reported === null
  const total = reported ? reported.totalTokens : estimatedTokens

  if (total === 0) return null

  return (
    <Popover>
      <PopoverTrigger
        className="text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
        aria-label="Token usage"
      >
        <GaugeIcon className="size-3.5" />
        <span className="tabular-nums">
          {isEstimate && '~'}
          {formatTokens(total)} tokens
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 text-sm font-medium">Token usage</p>

        {reported ? (
          <div className="divide-border divide-y">
            <Row label="Input" value={reported.inputTokens.toLocaleString()} />
            <Row label="Output" value={reported.outputTokens.toLocaleString()} />
            {reported.cacheReadTokens > 0 && (
              <Row label="Cached read" value={reported.cacheReadTokens.toLocaleString()} />
            )}
            {reported.cacheWriteTokens > 0 && (
              <Row label="Cached write" value={reported.cacheWriteTokens.toLocaleString()} />
            )}
            <Row label="Total" value={reported.totalTokens.toLocaleString()} />
            {reported.requests > 0 && <Row label="Model requests" value={String(reported.requests)} />}
            {reported.toolCalls > 0 && <Row label="Tool calls" value={String(reported.toolCalls)} />}
          </div>
        ) : (
          <div className="divide-border divide-y">
            <Row label="Estimated total" value={`~${estimatedTokens.toLocaleString()}`} />
          </div>
        )}

        <p className="text-muted-foreground mt-3 text-xs">
          {reported
            ? reportedTurns < assistantTurns
              ? `Reported by the agent for ${reportedTurns} of ${assistantTurns} replies.`
              : 'Reported by the agent.'
            : "Estimated from the conversation text — this agent doesn't report usage."}
        </p>
      </PopoverContent>
    </Popover>
  )
}
