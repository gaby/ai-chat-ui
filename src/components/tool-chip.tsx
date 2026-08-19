import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getToolIcon } from '@/lib/tool-icons'
import { cn } from '@/lib/utils'
import type { BuiltinTool } from '@/types'

/**
 * One builtin tool as a toggle. Lit means the next message may use it; the
 * pressed state is what carries that to assistive tech, not the colour.
 */
export function ToolChip({ tool, active, onToggle }: { tool: BuiltinTool; active: boolean; onToggle: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={active}
          onClick={onToggle}
          className={cn(
            'flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors',
            active
              ? 'border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15'
              : 'border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {getToolIcon(tool.id, cn('size-3.5', active && 'text-primary'))}
          <span className="max-w-32 truncate">{tool.name}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{active ? `Disable ${tool.name}` : `Enable ${tool.name}`}</TooltipContent>
    </Tooltip>
  )
}
