import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToolChip } from '@/components/tool-chip'
import { getToolIcon } from '@/lib/tool-icons'
import type { BuiltinTool } from '@/types'

// Beyond this many, chips stop being a bar and start being a wall; the rest
// move into an overflow menu.
const INLINE_LIMIT = 3

interface ToolToggleBarProps {
  tools: BuiltinTool[]
  enabled: string[]
  onToggle: (id: string) => void
}

/**
 * Builtin tools as toggle chips rather than switches behind a menu.
 *
 * Which tools the next message may use is a decision people revisit constantly,
 * so it belongs in the open: a chip lit up says "this is on" without a trip
 * through a dropdown, and toggling costs one click instead of three.
 */
export function ToolToggleBar({ tools, enabled, onToggle }: ToolToggleBarProps) {
  if (tools.length === 0) return null

  // Declaration order, deliberately not enabled-first: re-sorting on toggle
  // moved chips (and the still-open overflow menu's rows) out from under the
  // pointer that had just clicked them.
  const inline = tools.slice(0, INLINE_LIMIT)
  const overflow = tools.slice(INLINE_LIMIT)
  const overflowEnabled = overflow.filter((tool) => enabled.includes(tool.id)).length

  return (
    <div className="flex min-w-0 items-center gap-1">
      {inline.map((tool) => (
        <ToolChip
          key={tool.id}
          tool={tool}
          active={enabled.includes(tool.id)}
          onToggle={() => {
            onToggle(tool.id)
          }}
        />
      ))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More tools"
            className="text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-sm transition-colors"
          >
            +{overflow.length}
            {overflowEnabled > 0 && <span className="bg-primary size-1.5 rounded-full" />}
            <ChevronDownIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {overflow.map((tool) => (
              <DropdownMenuItem
                key={tool.id}
                onSelect={(event) => {
                  // Keep the menu open so several tools can be flipped at once.
                  event.preventDefault()
                  onToggle(tool.id)
                }}
              >
                {getToolIcon(tool.id, 'size-3.5')}
                <span className="flex-1 truncate">{tool.name}</span>
                {enabled.includes(tool.id) && <CheckIcon className="text-primary size-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
