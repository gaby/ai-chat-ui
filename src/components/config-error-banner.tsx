import { RefreshCcwIcon, WifiOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Shown when `/api/configure` cannot be reached. Without it the composer just
 * sits there with an empty model select and sending fails silently — this says
 * what is wrong and offers the one useful action.
 */
export function ConfigErrorBanner({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 rounded-lg border px-3 py-2 text-sm"
    >
      <WifiOffIcon className="text-destructive size-4 shrink-0" />
      <span className="min-w-0 flex-1">Couldn&apos;t reach the agent to load models.</span>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        <RefreshCcwIcon className="size-3.5" />
        {isRetrying ? 'Retrying' : 'Retry'}
      </Button>
    </div>
  )
}
