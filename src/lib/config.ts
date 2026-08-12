import type { BuiltinTool, ModelConfig } from '@/types'

export interface RemoteConfig {
  models: ModelConfig[]
  builtinTools: BuiltinTool[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isModelConfig(value: unknown): value is ModelConfig {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.builtinTools) &&
    value.builtinTools.every((tool) => typeof tool === 'string')
  )
}

function isBuiltinTool(value: unknown): value is BuiltinTool {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string'
}

/**
 * The elements are checked, not just the arrays.
 *
 * A backend that answers with the right keys and the wrong contents used to pass
 * here and fail later in render — a model without `name` reaches the select as a
 * blank option that cannot be told apart from its neighbours, and one without
 * `id` sends a request the server rejects. Rejecting the response instead puts
 * the retry banner in front of it.
 */
function isRemoteConfig(value: unknown): value is RemoteConfig {
  if (!isRecord(value)) return false
  return (
    Array.isArray(value.models) &&
    value.models.every(isModelConfig) &&
    Array.isArray(value.builtinTools) &&
    value.builtinTools.every(isBuiltinTool)
  )
}

/**
 * Read the backend's model and builtin-tool configuration.
 *
 * Both the status and the shape are checked before the body is handed back. A
 * `fetch` resolves for a 4xx or 5xx just as happily as for a 200, so an error
 * payload used to be cast to a configuration and stored as a successful result:
 * the banner offering a retry never appeared, and the first read of a property
 * that error bodies do not have (`models.find(...)`) threw during render, taking
 * the chat down instead.
 */
export async function fetchConfig(): Promise<RemoteConfig> {
  const res = await fetch('/api/configure')
  if (!res.ok) {
    throw new Error(`Configuration request failed with ${String(res.status)}`)
  }
  const body: unknown = await res.json()
  if (!isRemoteConfig(body)) {
    throw new Error('Configuration response did not contain models and builtin tools')
  }
  return body
}
