import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * The user's turn: a right-aligned bubble on a neutral surface. It stays quiet
 * on purpose — the agent's output is what the eye should land on, and the
 * alignment alone is enough to tell the two apart.
 */
export function UserBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="animate-message-in flex w-full justify-end">
      <div
        className={cn(
          'bg-secondary text-secondary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[0.9375rem] break-words sm:max-w-[75%]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
