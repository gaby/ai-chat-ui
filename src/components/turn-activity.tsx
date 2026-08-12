import { ChevronRightIcon, LoaderIcon, ShieldAlertIcon, SparklesIcon, XCircleIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { COMPLETE_TOOL_STATES } from '@/lib/tool-grouping'
import { cn } from '@/lib/utils'

// Long enough to register that the work finished, short enough not to sit in
// front of the answer.
const AUTO_COLLAPSE_DELAY = 1000

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

  const [open, setOpen] = useState(isStreaming)
  const [duration, setDuration] = useState(0)
  const startedAt = useRef<number | null>(null)
  // Summed across streamed intervals, because a turn can stop and start again:
  // an approval pauses it, and the continuation is a second stream. Replacing
  // the total each time reported only the last leg — 20s of work before an
  // approval and 2s after read as "Worked for 2s". The wait for the human is
  // excluded, since the clock only runs between a rise and the next fall.
  const elapsed = useRef(0)
  const userToggled = useRef(false)

  const needsApproval = calls.some((call) => call.state === 'approval-requested')
  const hasError = calls.some((call) => call.state === 'output-error')
  // A decision to make or a failure to read is not something to fold away.
  const held = needsApproval || hasError

  // Timing and auto-collapse key off the same transition, so they share one
  // effect — split, the first cleared `startedAt` before the second read it.
  useEffect(() => {
    if (isStreaming) {
      startedAt.current ??= Date.now()
      setOpen(true)
      return
    }

    // Nothing streamed here: a conversation restored from storage opens folded
    // and stays wherever the reader puts it.
    if (startedAt.current === null) return

    elapsed.current += Date.now() - startedAt.current
    startedAt.current = null
    setDuration(Math.max(1, Math.round(elapsed.current / 1000)))

    // Never pull it shut under someone who opened it, and never fold away a
    // pending approval or a failure — the timer is scheduled as the stream ends,
    // which is after both of those are already known.
    if (userToggled.current || held) return
    const timer = setTimeout(() => {
      // Checked again, not just before scheduling: a second is long enough for
      // someone to open it in the meantime, and this would shut it under them.
      if (userToggled.current) return
      setOpen(false)
    }, AUTO_COLLAPSE_DELAY)
    return () => {
      clearTimeout(timer)
    }
    // Keyed on `isStreaming` alone: `held` is read at the moment the stream
    // ends, and must not re-run the timing logic when it changes.
  }, [isStreaming])

  useEffect(() => {
    if (held) setOpen(true)
  }, [held])

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
      onOpenChange={(next) => {
        userToggled.current = true
        setOpen(next)
      }}
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
