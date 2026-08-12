import { ChevronRightIcon, LoaderIcon, ShieldAlertIcon, SparklesIcon, XCircleIcon } from 'lucide-react'
import { type ReactNode } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useStreamingDisclosure } from '@/hooks/useStreamingDisclosure'
import { COMPLETE_TOOL_STATES } from '@/lib/tool-grouping'
import { cn } from '@/lib/utils'

// Past this the line stops being scannable, which is the whole point of it.
const MAX_NAMED_TOOLS = 3

interface TurnActivityProps {
  /**
   * One entry per call, in order. Names are deduplicated for the summary line
   * only — pairing them here keeps "which tool is still running" answerable
   * after a repeated call collapses two entries into one name.
   */
  calls: { name: string; state: string }[]
  hasReasoning: boolean
  isStreaming: boolean
  /** One row per step: reasoning trace, tool card, tool group. */
  children: ReactNode
}

function summarize(toolNames: string[]): string {
  if (toolNames.length === 0) return ''
  if (toolNames.length <= MAX_NAMED_TOOLS) return toolNames.join(', ')
  return `${toolNames.slice(0, MAX_NAMED_TOOLS).join(', ')} +${String(toolNames.length - MAX_NAMED_TOOLS)}`
}

/**
 * Everything the agent did on the way to its answer, behind one line.
 *
 * A turn that reasons and calls four tools used to stack five cards above the
 * reply, so the answer started below the fold and the shape of the turn was
 * whatever the agent happened to do. Folded, it is one row that still names the
 * tools it ran; opened, every step keeps its own arguments and results — the
 * detail is a click away, not summarised out of existence.
 *
 * It opens itself while the work is happening, because that is when watching it
 * is worth anything, and folds up once the answer lands. Anything that needs a
 * person — a pending approval, a failed call — holds it open instead.
 */
export function TurnActivity({ calls, hasReasoning, isStreaming, children }: TurnActivityProps) {
  // Nothing but thinking so far. The reasoning line is already a fold of its
  // own, so this one steps out of the way — but it stays mounted, because the
  // first tool call turns it into the wrapper and a remount here would restart
  // both timers. A turn that reasoned for 30s and then ran a tool for 2s
  // reported "Worked for 2s".
  const bare = calls.length === 0

  const needsApproval = calls.some((call) => call.state === 'approval-requested')
  const hasError = calls.some((call) => call.state === 'output-error')
  // A decision to make or a failure to read is not something to fold away.
  const held = needsApproval || hasError

  const { open, onOpenChange, duration } = useStreamingDisclosure({ isStreaming, held })

  const running = calls.find((call) => !COMPLETE_TOOL_STATES.has(call.state))?.name
  const trail = summarize([...new Set(calls.map((call) => call.name))])

  let label: string
  let Icon = SparklesIcon
  let tone = ''

  if (needsApproval) {
    label = 'Waiting for your approval'
    Icon = ShieldAlertIcon
    tone = 'text-amber-600 dark:text-amber-500'
  } else if (isStreaming) {
    label = running ? `Running ${running}` : hasReasoning ? 'Thinking' : 'Working'
    Icon = LoaderIcon
  } else if (hasError) {
    label = trail ? `Ran into a problem · ${trail}` : 'Ran into a problem'
    Icon = XCircleIcon
    tone = 'text-destructive'
  } else if (duration > 0) {
    label = trail ? `Worked for ${String(duration)}s · ${trail}` : `Worked for ${String(duration)}s`
  } else {
    label = trail || 'Activity'
  }

  return (
    <Collapsible
      data-testid="turn-activity"
      open={bare || open}
      onOpenChange={onOpenChange}
      className="not-prose w-full"
    >
      {!bare && (
        <CollapsibleTrigger
          // A stable name either way: the label says what happened, this says
          // what the control does.
          aria-label={open ? 'Hide activity' : 'Show activity'}
          className={cn(
            'text-muted-foreground hover:text-foreground group flex max-w-full items-center gap-1.5 text-sm transition-colors',
            tone,
          )}
        >
          <Icon className={cn('size-4 shrink-0', isStreaming && 'text-primary animate-spin')} />
          <span className={cn('truncate', isStreaming && 'animate-pulse')}>{label}</span>
          <ChevronRightIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        </CollapsibleTrigger>
      )}

      <CollapsibleContent className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden">
        {/* One rail down the left, so a run of steps reads as a sequence rather
            than as unrelated cards that happen to be stacked. Bare, the same
            elements carry no rail and no indent — identical markup, so nothing
            below remounts when the first tool call arrives. */}
        <ol
          data-bare={bare}
          className={cn('group/rail space-y-3', !bare && 'border-border/70 mt-2 ml-2 border-l pl-4')}
        >
          {children}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** One step on the rail. */
export function TurnActivityStep({ children }: { children: ReactNode }) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className="bg-border absolute top-2.5 -left-[1.3125rem] size-2 rounded-full ring-2 ring-[var(--color-background)] group-data-[bare=true]/rail:hidden"
      />
      {children}
    </li>
  )
}
