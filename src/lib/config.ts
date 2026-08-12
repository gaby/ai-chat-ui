import type { BuiltinTool, ModelConfig } from '@/types'

export interface RemoteConfig {
  models: ModelConfig[]
  builtinTools: BuiltinTool[]
}

function isRemoteConfig(value: unknown): value is RemoteConfig {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<RemoteConfig>
  return Array.isArray(candidate.models) && Array.isArray(candidate.builtinTools)
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
