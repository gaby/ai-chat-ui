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
  timestamp: number
  forkOf?: {
    conversationId: string
    messageIndex: number
  }
}
