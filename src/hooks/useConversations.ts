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
    const loadConversations = () => {
      getConversations()
        .then(setConversations)
        .catch((err: unknown) => {
          console.error('Failed to load conversations:', err)
        })
    }

    loadConversations()
    window.addEventListener('conversations-changed', loadConversations)

    return () => {
      window.removeEventListener('conversations-changed', loadConversations)
    }
  }, [])

  return conversations
}
