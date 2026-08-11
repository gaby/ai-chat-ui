import { CheckIcon } from 'lucide-react'

import { EffortBars } from '@/components/effort-bars'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { THINKING_EFFORT_LEVELS, type ThinkingEffort } from '@/lib/generated/thinking-effort.gen'
import { cn } from '@/lib/utils'

// Display copy is a UI concern and stays here; the levels come from pydantic-ai
// via the generated module. The Records are exhaustive over ThinkingEffort, so
// adding a level upstream forces copy here rather than silently dropping it.
const EFFORT_LABELS: Record<ThinkingEffort, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
}

const EFFORT_DESCRIPTIONS: Record<ThinkingEffort, string> = {
  minimal: 'Answer straight away',
  low: 'A quick think first',
  medium: 'Balanced — the default',
  high: 'Work the problem through',
  xhigh: 'Take as long as it needs',
}

function levelIndex(value: string): number {
  const index = THINKING_EFFORT_LEVELS.indexOf(value as ThinkingEffort)
  return index === -1 ? THINKING_EFFORT_LEVELS.indexOf('medium') : index
}

interface EffortMeterProps {
  value: string
  onValueChange: (value: string) => void
}

/**
 * How hard the agent should think, as a meter instead of a dropdown.
 *
 * Effort is an intensity, and a select box renders it as five interchangeable
 * strings. The bars show where the current setting sits in the range before the
 * control is even opened, and animate when it moves.
 */
export function EffortMeter({ value, onValueChange }: EffortMeterProps) {
  const current = levelIndex(value)
  const level = THINKING_EFFORT_LEVELS[current]

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Thinking effort: ${EFFORT_LABELS[level]}`}
        className="text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground group flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors"
      >
        <EffortBars level={current} total={THINKING_EFFORT_LEVELS.length} className="group-hover:opacity-90" />
        {EFFORT_LABELS[level]}
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-1.5">
        <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">Thinking effort</p>
        <div role="radiogroup" aria-label="Thinking effort">
          {THINKING_EFFORT_LEVELS.map((option, index) => {
            const selected = option === level
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  onValueChange(option)
                }}
                className={cn(
                  'hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  selected && 'bg-accent',
                )}
              >
                <EffortBars level={index} total={THINKING_EFFORT_LEVELS.length} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{EFFORT_LABELS[option]}</span>
                  <span className="text-muted-foreground block text-xs">{EFFORT_DESCRIPTIONS[option]}</span>
                </span>
                {selected && <CheckIcon className="text-primary size-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
