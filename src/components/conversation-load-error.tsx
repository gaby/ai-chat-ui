import { DatabaseBackupIcon } from 'lucide-react'

import { RetryBanner } from '@/components/retry-banner'

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
    <RetryBanner icon={DatabaseBackupIcon} onRetry={onRetry} retryLabel="Try again">
      Couldn&apos;t open this conversation from browser storage. Its messages are still saved — sending is paused so a
      new reply cannot overwrite them.
    </RetryBanner>
  )
}
