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
  // Blank counts as absent, matching the `title` branch above. `??` here let an
  // empty first message through, so every surface rendered an empty name.
  const firstMessage = entry?.firstMessage?.trim()
  if (firstMessage) return firstMessage
  return UNTITLED
}
