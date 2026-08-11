import { CheckIcon } from 'lucide-react'

import { Response } from '@/components/ai-elements/response'
import { parseReasoningSteps } from '@/lib/reasoning-steps'
import { cn } from '@/lib/utils'

/**
 * The model's thinking as a timeline of steps rather than a block of text.
 *
 * A long reasoning stream is a sequence of moves, and reading it as one
 * paragraph loses that. Each step gets a marker on a rail, a heading when the
 * model gave one, and muted body text — so the shape of the reasoning is
 * legible before a word of it is read.
 */
export function ReasoningTrace({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const steps = parseReasoningSteps(text)
  if (steps.length === 0) return null

  return (
    <ol className="mt-1 space-y-3">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const isRunning = isStreaming && isLast

        return (
          <li key={index} className="flex gap-2.5">
            <span className="flex flex-col items-center self-stretch">
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                  isRunning ? 'bg-primary/15' : 'bg-muted',
                )}
              >
                {isRunning ? (
                  <span className="bg-primary size-1.5 animate-pulse rounded-full" />
                ) : (
                  <CheckIcon className="text-muted-foreground size-2.5" />
                )}
              </span>
              {!isLast && <span className="bg-border mt-1 w-px flex-1" />}
            </span>

            <div className="min-w-0 flex-1 pb-1">
              {step.title && <p className="text-foreground text-sm font-medium">{step.title}</p>}
              {step.body && <Response className="text-muted-foreground mt-1 text-sm leading-6">{step.body}</Response>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
