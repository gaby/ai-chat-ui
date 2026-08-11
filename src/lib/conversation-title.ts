import type { ConversationEntry } from '@/types'

const UNTITLED = 'Untitled chat'

/**
 * Display name for a conversation: the name the user gave it, else the opening
 * message it was derived from. Every surface that shows a conversation (sidebar
 * row, header, tab title, delete confirmation) goes through here so a rename
 * lands everywhere at once.
 */
export function conversationTitle(entry: Pick<ConversationEntry, 'title' | 'firstMessage'> | undefined): string {
  const title = entry?.title?.trim()
  if (title) return title
  const firstMessage = entry?.firstMessage?.trim()
  return firstMessage ?? UNTITLED
}
