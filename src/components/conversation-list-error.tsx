import { DatabaseBackupIcon } from 'lucide-react'

import { RetryBanner } from '@/components/retry-banner'

/**
 * Shown in place of the conversation list when it could not be read from
 * browser storage.
 *
 * The list is the only way back into an existing chat, so an empty sidebar
 * reading "No conversations yet." is indistinguishable from having lost them —
 * and nothing re-reads the store on its own, so without a retry the reader is
 * stuck there for the rest of the session. Hidden while the sidebar is
 * collapsed to icons, where the rail is too narrow to say anything.
 */
export function ConversationListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="group-data-[state=collapsed]:hidden">
      <RetryBanner icon={DatabaseBackupIcon} onRetry={onRetry} retryLabel="Try again">
        Couldn&apos;t load your chats from browser storage.
      </RetryBanner>
    </div>
  )
}
