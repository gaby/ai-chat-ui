import { DatabaseBackupIcon, RefreshCcwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Shown when a conversation's history could not be read from browser storage.
 *
 * The failure is almost always transient, and the messages are still there — so
 * this offers the read again rather than dropping the reader into what looks
 * like an empty chat. Sending stays blocked until it succeeds: a reply written
 * now would be saved over the history that failed to load.
 */
export function ConversationLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 rounded-lg border px-3 py-2 text-sm"
    >
      <DatabaseBackupIcon className="text-destructive size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Couldn&apos;t open this conversation from browser storage. Its messages are still saved — sending is paused so
        a new reply cannot overwrite them.
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCcwIcon className="size-3.5" />
        Try again
      </Button>
    </div>
  )
}
