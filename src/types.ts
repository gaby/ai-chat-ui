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
  /** Last activity, which is what the sidebar sorts and buckets by. */
  timestamp: number
  /**
   * When the conversation was created. `timestamp` moves as the conversation is
   * used, so anything that needs a stable order (fork siblings) reads this.
   * Absent on entries written before it existed; fall back to `timestamp`.
   */
  createdAt?: number
  forkOf?: {
    conversationId: string
    messageIndex: number
  }
}
