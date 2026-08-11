import { useEffect, useState } from 'react'

import { getConversations } from '@/lib/chat-db'
import type { ConversationEntry } from '@/types'

// Conversations live in IndexedDB and are mutated from several places (a new
// chat, a fork, a delete). Writers dispatch `conversations-changed`; every
// subscriber re-reads the store, which keeps the sidebar and the header title
// in sync without threading state through the tree.
export interface ConversationsState {
  conversations: ConversationEntry[]
  /**
   * Whether the store has been read at least once. Before that, an empty list
   * means "not read yet", not "no conversations" — a caller that cannot tell
   * the two apart renders its not-found state over every reload.
   */
  loaded: boolean
}

export function useConversationsState(): ConversationsState {
  const [state, setState] = useState<ConversationsState>({ conversations: [], loaded: false })

  useEffect(() => {
    // Reads triggered by two writes in quick succession can resolve out of
    // order; only the newest one is allowed to win, so a deleted conversation
    // cannot reappear from an older in-flight snapshot.
    let latest = 0
    let cancelled = false

    const loadConversations = () => {
      const request = ++latest
      getConversations()
        .then((conversations) => {
          if (!cancelled && request === latest) setState({ conversations, loaded: true })
        })
        .catch((err: unknown) => {
          console.error('Failed to load conversations:', err)
          // Still "loaded": the read is over, and leaving it pending would hold
          // every caller in its loading state for good.
          if (!cancelled && request === latest) setState({ conversations: [], loaded: true })
        })
    }

    loadConversations()
    window.addEventListener('conversations-changed', loadConversations)

    return () => {
      cancelled = true
      window.removeEventListener('conversations-changed', loadConversations)
    }
  }, [])

  return state
}

/** The list alone, for callers that have nothing to show while it loads. */
export function useConversations(): ConversationEntry[] {
  return useConversationsState().conversations
}
