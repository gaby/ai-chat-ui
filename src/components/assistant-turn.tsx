import type { ReactNode } from 'react'

import logoSvg from '@/assets/logo.svg'

/**
 * One assistant turn: an avatar gutter plus a single column holding everything
 * the agent produced — reasoning, tool cards, and the answer. Keeping the whole
 * turn in one column (rather than styling each part on its own) is what makes a
 * multi-step run read as a sequence instead of a pile of unrelated cards.
 */
export function AssistantTurn({ children }: { children: ReactNode }) {
  return (
    <div className="animate-message-in group/assistant flex w-full gap-3 py-3">
      <span
        aria-hidden
        className="bg-card mt-0.5 hidden size-7 shrink-0 items-center justify-center rounded-lg border shadow-xs sm:flex"
      >
        <img src={logoSvg} alt="" className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </div>
  )
}
