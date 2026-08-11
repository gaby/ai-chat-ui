import type { UIMessage } from 'ai'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  requests: number
  toolCalls: number
}

/**
 * Rough characters-per-token ratio for English prose. Only used for the
 * fallback estimate, which is always labelled as approximate — shipping a real
 * tokenizer would cost more bundle than the number is worth, and the right
 * number comes from the backend anyway.
 */
const CHARS_PER_TOKEN = 4

function readNumber(source: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return 0
}

/**
 * Read token usage a backend attached to an assistant message.
 *
 * The contract is `UIMessage.metadata.usage`; pydantic-ai's Vercel adapter
 * merges `ModelResponse.metadata` into the `message-metadata` chunk, so a
 * backend only has to write the key. Both camelCase and snake_case are accepted
 * because Python backends emit either.
 */
export function parseUsage(metadata: unknown): TokenUsage | null {
  if (metadata === null || typeof metadata !== 'object') return null
  const raw = (metadata as Record<string, unknown>).usage
  if (raw === null || typeof raw !== 'object') return null

  const source = raw as Record<string, unknown>
  const inputTokens = readNumber(source, 'inputTokens', 'input_tokens')
  const outputTokens = readNumber(source, 'outputTokens', 'output_tokens')
  const totalTokens = readNumber(source, 'totalTokens', 'total_tokens') || inputTokens + outputTokens

  if (totalTokens === 0 && inputTokens === 0 && outputTokens === 0) return null

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cacheReadTokens: readNumber(source, 'cacheReadTokens', 'cache_read_tokens'),
    cacheWriteTokens: readNumber(source, 'cacheWriteTokens', 'cache_write_tokens'),
    requests: readNumber(source, 'requests'),
    toolCalls: readNumber(source, 'toolCalls', 'tool_calls'),
  }
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    requests: a.requests + b.requests,
    toolCalls: a.toolCalls + b.toolCalls,
  }
}

/** Every character the model saw or produced, as far as the client can tell. */
function messageCharacters(message: UIMessage): number {
  let characters = 0
  for (const part of message.parts) {
    if (part.type === 'text' || part.type === 'reasoning') {
      characters += part.text.length
    } else if ('toolCallId' in part) {
      const tool = part as { input?: unknown; output?: unknown }
      if (tool.input !== undefined) characters += JSON.stringify(tool.input).length
      if (tool.output !== undefined) characters += JSON.stringify(tool.output).length
    }
  }
  return characters
}

export function estimateTokens(messages: UIMessage[]): number {
  const characters = messages.reduce((total, message) => total + messageCharacters(message), 0)
  return Math.ceil(characters / CHARS_PER_TOKEN)
}

export interface ConversationUsage {
  /** Summed from the turns that reported usage; null when none did. */
  reported: TokenUsage | null
  /** How many assistant turns reported usage, out of how many there are. */
  reportedTurns: number
  assistantTurns: number
  /** Local approximation, used when the backend reports nothing. */
  estimatedTokens: number
}

export function conversationUsage(messages: UIMessage[]): ConversationUsage {
  let reported: TokenUsage | null = null
  let reportedTurns = 0
  let assistantTurns = 0

  for (const message of messages) {
    if (message.role !== 'assistant') continue
    assistantTurns += 1
    const usage = parseUsage(message.metadata)
    if (!usage) continue
    reportedTurns += 1
    reported = reported ? addUsage(reported, usage) : usage
  }

  return { reported, reportedTurns, assistantTurns, estimatedTokens: estimateTokens(messages) }
}

/** Compact token count: `842`, `12.4k`, `1.3M`. */
export function formatTokens(count: number): string {
  if (count < 1000) return String(count)
  if (count < 1_000_000) {
    const thousands = count / 1000
    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}k`
  }
  return `${(count / 1_000_000).toFixed(1)}M`
}
