import { useSyncExternalStore } from 'react'

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

/**
 * One read shared by every consumer.
 *
 * A `ForkNavigation` is mounted under each user turn, so a hook that opened its
 * own subscription meant one full `getAll()` per turn on every change event —
 * and an active run emits one every 30 seconds. A long conversation turned each
 * of those into dozens of reads and dozens of renders.
 */
let state: ConversationsState = { conversations: [], loaded: false }
const listeners = new Set<() => void>()

// Reads triggered by two writes in quick succession can resolve out of order;
// only the newest is allowed to win, so a deleted conversation cannot reappear
// from an older in-flight snapshot.
let latest = 0

function refresh(): void {
  const request = ++latest
  getConversations()
    .then((conversations) => {
      if (request !== latest) return
      state = { conversations, loaded: true }
      for (const listener of listeners) listener()
    })
    .catch((err: unknown) => {
      console.error('Failed to load conversations:', err)
      if (request !== latest || state.loaded) return
      // Marked loaded so nothing waits forever, but the last good list is kept:
      // a failed refresh must not empty the sidebar and blank the header title.
      state = { conversations: state.conversations, loaded: true }
      for (const listener of listeners) listener()
    })
}

function subscribe(listener: () => void): () => void {
  // With nobody subscribed there is no `conversations-changed` listener, so any
  // write in that window is missed. Re-read whenever the first subscriber
  // arrives — otherwise `loaded` stays true from the previous run and the list
  // that comes back is however stale the gap left it.
  const reconnecting = listeners.size === 0
  if (reconnecting) {
    window.addEventListener('conversations-changed', refresh)
  }
  listeners.add(listener)
  if (reconnecting || !state.loaded) refresh()

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('conversations-changed', refresh)
    }
  }
}

function getSnapshot(): ConversationsState {
  return state
}

export function useConversationsState(): ConversationsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** The list alone, for callers that have nothing to show while it loads. */
export function useConversations(): ConversationEntry[] {
  return useConversationsState().conversations
}
