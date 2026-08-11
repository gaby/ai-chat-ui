import type { ReactNode } from 'react'

import logoSvg from '@/assets/logo.svg'
import { cn } from '@/lib/utils'

/**
 * One assistant turn: an avatar gutter plus a single column holding everything
 * the agent produced — reasoning, tool cards, and the answer. Keeping the whole
 * turn in one column (rather than styling each part on its own) is what makes a
 * multi-step run read as a sequence instead of a pile of unrelated cards.
 *
 * While the turn is live the avatar pulses, so a long stretch of tool calls
 * with no prose still reads as "working" rather than "stuck".
 */
export function AssistantTurn({ children, isStreaming = false }: { children: ReactNode; isStreaming?: boolean }) {
  return (
    <div className="animate-message-in group/assistant flex w-full gap-3 py-3">
      <span
        aria-hidden
        className={cn(
          'bg-card mt-0.5 hidden size-7 shrink-0 items-center justify-center rounded-lg border shadow-xs sm:flex',
          isStreaming && 'ring-primary/30 animate-pulse ring-2',
        )}
      >
        <img src={logoSvg} alt="" className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </div>
  )
}
