import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * One of the small helpers under a message — copy, regenerate, edit.
 *
 * They stay visible rather than appearing on hover: hover does not exist on
 * touch, and a permanently low-contrast icon costs less attention than a row
 * that materialises whenever the pointer drifts past.
 */
export function MessageAction({
  label,
  onClick,
  children,
  className,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            'text-muted-foreground/70 hover:text-foreground hover:bg-accent focus-visible:ring-ring flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none',
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
