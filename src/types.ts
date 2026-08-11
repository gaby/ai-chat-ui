export interface ModelConfig {
  id: string
  name: string
  builtinTools: string[]
}

export interface BuiltinTool {
  name: string
  id: string
}

export interface ConversationEntry {
  id: string
  firstMessage?: string
  /** User-chosen name, overriding the first-message fallback. */
  title?: string
  /** Kept at the top of the sidebar, above the date buckets. */
  pinned?: boolean
  timestamp: number
  forkOf?: {
    conversationId: string
    messageIndex: number
  }
}
