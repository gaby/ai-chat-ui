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

/**
 * Per-message character counts, keyed by the parts array that produced them.
 *
 * The estimate runs on every render, and a render happens on every streamed
 * chunk — so without this, a long conversation re-stringified every historical
 * tool payload hundreds of times over a single reply. A part array is replaced
 * whenever its message changes, which makes identity a sound cache key and
 * leaves invalidation to the garbage collector.
 */
const characterCache = new WeakMap<object, number>()

/** Every character the model saw or produced, as far as the client can tell. */
function messageCharacters(message: UIMessage): number {
  const cached = characterCache.get(message.parts)
  if (cached !== undefined) return cached

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

  characterCache.set(message.parts, characters)
  return characters
}

/**
 * Approximate what a conversation cost, in the same terms a backend reports.
 *
 * A reported total is the sum of each request's usage, and every request carries
 * the conversation so far — so a turn costs the prefix it was sent plus what it
 * produced, and the prefix is paid again on every turn. Counting each message
 * once instead put the two numbers on different scales: the same widget showed a
 * long chat as a fraction of what the identical chat reported elsewhere.
 *
 * Still an approximation, and labelled one. It cannot see the system prompt, and
 * a turn that loops through tools is several requests rather than the one
 * counted here, so it reads low on tool-heavy turns.
 */
export function estimateTokens(messages: UIMessage[], { skipReported = false } = {}): number {
  let sent = 0
  let characters = 0

  for (const message of messages) {
    const own = messageCharacters(message)
    // The request that produced this reply carried everything before it.
    if (message.role === 'assistant' && !(skipReported && parseUsage(message.metadata))) {
      characters += sent + own
    }
    sent += own
  }

  return Math.ceil(characters / CHARS_PER_TOKEN)
}

export interface ConversationUsage {
  /** Summed from the turns that reported usage; null when none did. */
  reported: TokenUsage | null
  /** How many assistant turns reported usage, out of how many there are. */
  reportedTurns: number
  assistantTurns: number
  /**
   * Local approximation of the turns nobody reported for. With none reporting
   * that is the whole conversation; with some reporting it is the gap, which
   * belongs on top of `reported` rather than being left out of the total. 0 once
   * every turn has reported.
   */
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

  // The estimate walks and stringifies every tool payload in the conversation,
  // and this runs on every render. Only pay for it when it is part of the number
  // the UI will actually show — which a partial history is: summing the turns
  // that reported and printing that as the conversation total made a long chat
  // with one newly-reported reply read as if it had cost only that reply.
  const estimatedTokens = reportedTurns === assistantTurns ? 0 : estimateTokens(messages, { skipReported: true })
  return { reported, reportedTurns, assistantTurns, estimatedTokens }
}

/** Compact token count: `842`, `12.4k`, `1.3M`. */
export function formatTokens(count: number): string {
  if (!Number.isFinite(count)) return '0'
  if (count < 1000) return String(Math.round(count))

  // Round first, then pick the unit: rounding inside the branch turned 999,999
  // into "1000k" instead of "1.0M".
  const thousands = count / 1000
  if (Math.round(thousands) < 1000) {
    return `${thousands < 9.95 ? thousands.toFixed(1) : Math.round(thousands)}k`
  }
  return `${(count / 1_000_000).toFixed(1)}M`
}
