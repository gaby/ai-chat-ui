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
  /** Tool names in call order, deduplicated. */
  toolNames: string[]
  /** Per-call states, for deciding what still needs a human. */
  states: string[]
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
export function TurnActivity({ toolNames, states, hasReasoning, isStreaming, children }: TurnActivityProps) {
  const [open, setOpen] = useState(isStreaming)
  const [duration, setDuration] = useState(0)
  const startedAt = useRef<number | null>(null)
  const userToggled = useRef(false)

  const needsApproval = states.includes('approval-requested')
  const hasError = states.includes('output-error')
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

    setDuration(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)))
    startedAt.current = null

    // Never pull it shut under someone who opened it, and never fold away a
    // pending approval or a failure — the timer is scheduled as the stream ends,
    // which is after both of those are already known.
    if (userToggled.current || held) return
    const timer = setTimeout(() => {
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

  const running = toolNames.find((_, i) => !COMPLETE_TOOL_STATES.has(states[i] ?? ''))
  const trail = summarize(toolNames)

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
      open={open}
      onOpenChange={(next) => {
        userToggled.current = true
        setOpen(next)
      }}
      className="not-prose w-full"
    >
      <CollapsibleTrigger
        // A stable name either way: the label says what happened, this says what
        // the control does.
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

      <CollapsibleContent className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden">
        {/* One rail down the left, so a run of steps reads as a sequence rather
            than as unrelated cards that happen to be stacked. */}
        <ol className="border-border/70 mt-2 ml-2 space-y-3 border-l pl-4">{children}</ol>
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
        className="bg-border absolute top-2.5 -left-[1.3125rem] size-2 rounded-full ring-2 ring-[var(--color-background)]"
      />
      {children}
    </li>
  )
}
