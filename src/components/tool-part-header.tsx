import type { DynamicToolUIPart, ToolUIPart } from 'ai'
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDashedIcon,
  LoaderIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  XCircleIcon,
} from 'lucide-react'

import { useMemo } from 'react'

import { CollapsibleTrigger } from '@/components/ui/collapsible'
import { getToolIcon } from '@/lib/tool-icons'
import { summarizeToolInput } from '@/lib/tool-summary'
import { cn } from '@/lib/utils'

type ToolState = (ToolUIPart | DynamicToolUIPart)['state']

interface StatusEntry {
  label: string
  icon: typeof CheckCircle2Icon
  className: string
}

const STATUS: Record<ToolState, StatusEntry> = {
  'input-streaming': { label: 'Pending', icon: CircleDashedIcon, className: 'text-muted-foreground' },
  'input-available': { label: 'Running', icon: LoaderIcon, className: 'text-primary' },
  'approval-requested': { label: 'Approval Required', icon: ShieldAlertIcon, className: 'text-amber-500' },
  'approval-responded': { label: 'Approval Responded', icon: ShieldCheckIcon, className: 'text-blue-500' },
  'output-available': { label: 'Completed', icon: CheckCircle2Icon, className: 'text-primary' },
  'output-error': { label: 'Error', icon: XCircleIcon, className: 'text-destructive' },
  'output-denied': { label: 'Denied', icon: ShieldXIcon, className: 'text-destructive' },
}

interface ToolPartHeaderProps {
  toolName: string
  state: ToolState
  input: unknown
  errorText?: string
}

// A state outside the seven mapped ones can only arrive from a newer adapter or
// a conversation persisted by another build. Degrade to a neutral row rather
// than throwing mid-render — there is no error boundary above this.
const UNKNOWN_STATUS: StatusEntry = { label: 'Unknown', icon: CircleDashedIcon, className: 'text-muted-foreground' }

/** The key is typed as one of the seven, but it arrives off the wire, so it is looked up rather than trusted. */
function statusFor(state: ToolState): StatusEntry {
  return Object.hasOwn(STATUS, state) ? STATUS[state] : UNKNOWN_STATUS
}

/**
 * Collapsed row for a tool call. It answers the two questions a reader has
 * before deciding to expand — which tool, and with what — and colours the state
 * rather than shouting it with a filled badge.
 */
export function ToolPartHeader({ toolName, state, input, errorText }: ToolPartHeaderProps) {
  const { label, icon: StatusIcon, className } = statusFor(state)
  const argumentSummary = useMemo(() => summarizeToolInput(input), [input])
  // On a failed call the reason is what the reader wants from the collapsed
  // row; the arguments are still one click away.
  const summary = errorText ? errorText.replace(/\s+/g, ' ').trim() : argumentSummary

  return (
    <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors">
      {getToolIcon(toolName, 'size-3.5 text-muted-foreground shrink-0')}
      <span className="shrink-0 font-mono text-xs font-medium">{toolName}</span>
      <span className={cn('flex shrink-0 items-center gap-1 text-xs', className)}>
        <StatusIcon className={cn('size-3.5', state === 'input-available' && 'animate-spin')} />
        {/* Hidden visually on a narrow screen, never hidden from assistive
            tech: colour and icon shape alone cannot carry "Error" vs "Denied". */}
        <span className="sr-only sm:not-sr-only">{label}</span>
      </span>
      {summary && (
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-xs',
            errorText ? 'text-destructive/80' : 'text-muted-foreground',
          )}
        >
          {summary}
        </span>
      )}
      {/* The trailing spacer is the slot `ToolPart` overlays its hover-revealed
          hide button into, reserved up front so nothing shifts on hover. */}
      <ChevronDownIcon className="text-muted-foreground ml-auto size-3.5 shrink-0 transition-transform group-data-[state=open]/tool-part:rotate-180" />
      <span aria-hidden className="w-4 shrink-0" />
    </CollapsibleTrigger>
  )
}
