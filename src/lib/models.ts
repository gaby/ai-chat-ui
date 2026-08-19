import type { ModelConfig } from '@/types'

/**
 * Which model should be selected once a configuration arrives.
 *
 * Run against every configuration, not just the first. A refetch that comes back
 * without the selected model — or with no models at all — used to leave the id
 * in place: the select is hidden at that point, so there is no way to correct
 * it, and the send button stays enabled because the id is still a non-empty
 * string, putting a model the backend no longer advertises on the next request.
 *
 * A model that is still on offer is kept, so a deliberate choice survives the
 * refetches that happen while a conversation is open.
 */
export function resolveSelectedModel(models: ModelConfig[], current: string): string {
  return models.some((entry) => entry.id === current) ? current : (models[0]?.id ?? '')
}
