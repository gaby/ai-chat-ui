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

import { CollapsibleTrigger } from '@/components/ui/collapsible'
import { getToolIcon } from '@/lib/tool-icons'
import { summarizeToolInput } from '@/lib/tool-summary'
import { cn } from '@/lib/utils'

type ToolState = (ToolUIPart | DynamicToolUIPart)['state']

const STATUS: Record<ToolState, { label: string; icon: typeof CheckCircle2Icon; className: string }> = {
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
}

/**
 * Collapsed row for a tool call. It answers the two questions a reader has
 * before deciding to expand — which tool, and with what — and colours the state
 * rather than shouting it with a filled badge.
 */
export function ToolPartHeader({ toolName, state, input }: ToolPartHeaderProps) {
  const status = STATUS[state]
  const StatusIcon = status.icon
  const summary = summarizeToolInput(input)

  return (
    <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors">
      {getToolIcon(toolName, 'size-3.5 text-muted-foreground shrink-0')}
      <span className="shrink-0 font-mono text-xs font-medium">{toolName}</span>
      <span className={cn('flex shrink-0 items-center gap-1 text-xs', status.className)}>
        <StatusIcon className={cn('size-3.5', state === 'input-available' && 'animate-spin')} />
        <span className="hidden sm:inline">{status.label}</span>
      </span>
      {summary && <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{summary}</span>}
      {/* The trailing spacer is the slot `ToolPart` overlays its hover-revealed
          hide button into, reserved up front so nothing shifts on hover. */}
      <ChevronDownIcon className="text-muted-foreground ml-auto size-3.5 shrink-0 transition-transform group-data-[state=open]/tool-part:rotate-180" />
      <span aria-hidden className="w-4 shrink-0" />
    </CollapsibleTrigger>
  )
}
