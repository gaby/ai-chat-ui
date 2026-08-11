import { useEffect, useState } from 'react'

import { getConversations } from '@/lib/chat-db'
import type { ConversationEntry } from '@/types'

// Conversations live in IndexedDB and are mutated from several places (a new
// chat, a fork, a delete). Writers dispatch `conversations-changed`; every
// subscriber re-reads the store, which keeps the sidebar and the header title
// in sync without threading state through the tree.
export function useConversations(): ConversationEntry[] {
  const [conversations, setConversations] = useState<ConversationEntry[]>([])

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
          if (!cancelled && request === latest) setConversations(conversations)
        })
        .catch((err: unknown) => {
          console.error('Failed to load conversations:', err)
        })
    }

    loadConversations()
    window.addEventListener('conversations-changed', loadConversations)

    return () => {
      cancelled = true
      window.removeEventListener('conversations-changed', loadConversations)
    }
  }, [])

  return conversations
}
