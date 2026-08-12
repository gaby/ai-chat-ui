import type { UIMessage } from 'ai'
import { GaugeIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { conversationUsage, formatTokens } from '@/lib/usage'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      {/* Labelled so the figure is reachable on its own, by a reader or a spec,
          without walking the DOM to find the term it belongs to. */}
      <dd className="font-mono tabular-nums" aria-label={`${label} tokens`}>
        {value}
      </dd>
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
  // Some replies reporting and others not is normal — a conversation carried
  // over from before the backend reported usage, or a turn served by a model
  // that does not. Summing only the turns that answered and printing it as the
  // conversation total reads as exact while undercounting, so it gets the same
  // `~` an estimate does.
  const isPartial = reported !== null && reportedTurns < assistantTurns
  // The unreported turns are estimated rather than dropped: a long conversation
  // whose latest reply is the only one that reported would otherwise show that
  // reply's few hundred tokens as the whole conversation's cost.
  const total = reported ? reported.totalTokens + estimatedTokens : estimatedTokens

  if (total === 0) return null

  return (
    <Popover>
      <PopoverTrigger
        className="text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent data-[state=open]:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
        aria-label="Token usage"
      >
        <GaugeIcon className="size-3.5" />
        <span className="tabular-nums">
          {(isEstimate || isPartial) && '~'}
          {formatTokens(total)} tokens
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 text-sm font-medium">Token usage</p>

        {reported ? (
          <dl className="divide-border divide-y">
            <Row label="Input" value={reported.inputTokens.toLocaleString()} />
            <Row label="Output" value={reported.outputTokens.toLocaleString()} />
            {reported.cacheReadTokens > 0 && (
              <Row label="Cached read" value={reported.cacheReadTokens.toLocaleString()} />
            )}
            {reported.cacheWriteTokens > 0 && (
              <Row label="Cached write" value={reported.cacheWriteTokens.toLocaleString()} />
            )}
            {isPartial ? (
              <>
                <Row label="Reported" value={reported.totalTokens.toLocaleString()} />
                <Row
                  label={`Estimated for ${String(assistantTurns - reportedTurns)} more`}
                  value={`~${estimatedTokens.toLocaleString()}`}
                />
                <Row label="Total" value={`~${(reported.totalTokens + estimatedTokens).toLocaleString()}`} />
              </>
            ) : (
              <Row label="Total" value={reported.totalTokens.toLocaleString()} />
            )}
            {reported.requests > 0 && <Row label="Model requests" value={String(reported.requests)} />}
            {reported.toolCalls > 0 && <Row label="Tool calls" value={String(reported.toolCalls)} />}
          </dl>
        ) : (
          <dl className="divide-border divide-y">
            <Row label="Estimated total" value={`~${estimatedTokens.toLocaleString()}`} />
          </dl>
        )}

        <p className="text-muted-foreground mt-3 text-xs">
          {reported
            ? reportedTurns < assistantTurns
              ? `Reported by the agent for ${reportedTurns} of ${assistantTurns} replies; the rest estimated from their text.`
              : 'Reported by the agent.'
            : "Estimated from the conversation text — this agent doesn't report usage."}
        </p>
      </PopoverContent>
    </Popover>
  )
}
