import { RefreshCcwIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface RetryBannerProps {
  icon: LucideIcon
  children: ReactNode
  onRetry: () => void
  /** Defaults to "Retry". */
  retryLabel?: string
  disabled?: boolean
}

/**
 * A failure the reader can do something about, stated in one line above the
 * composer.
 *
 * One shape for every such failure: the app had two of these written out
 * separately with the same class string, and `Chat.tsx` can render both at once,
 * so any drift between them showed up stacked on the same screen. The width and
 * padding match the conversation column, since that is where it appears.
 */
export function RetryBanner({
  icon: Icon,
  children,
  onRetry,
  retryLabel = 'Retry',
  disabled = false,
}: RetryBannerProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div
        role="alert"
        className="border-destructive/25 bg-destructive/5 mb-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <Icon className="text-destructive size-4 shrink-0" />
        <span className="min-w-0 flex-1">{children}</span>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={disabled}>
          <RefreshCcwIcon className="size-3.5" />
          {retryLabel}
        </Button>
      </div>
    </div>
  )
}
