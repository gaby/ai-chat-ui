import { AlertTriangleIcon, ArrowRightIcon, RefreshCcwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ChatErrorProps {
  message: string
  onRetry: () => void
  onContinue: () => void
}

/**
 * Failure state for a run. It separates what went wrong from what to do next,
 * so a stack-trace-ish provider message does not swallow the recovery actions.
 */
export function ChatError({ message, onRetry, onContinue }: ChatErrorProps) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 animate-message-in my-2 flex gap-3 rounded-xl border p-4"
    >
      <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-destructive text-sm font-medium">Something went wrong</p>
        <p className="text-muted-foreground mt-1 text-sm break-words">{message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCcwIcon className="size-3.5" />
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={onContinue}>
            <ArrowRightIcon className="size-3.5" />
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
