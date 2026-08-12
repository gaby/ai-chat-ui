import { describe, expect, it } from 'vitest'

import { resolveSelectedModel } from '../../src/lib/models'

const model = (id: string) => ({ id, name: id, builtinTools: [] })

describe('resolveSelectedModel', () => {
  it('selects the first model when nothing is selected yet', () => {
    expect(resolveSelectedModel([model('a'), model('b')], '')).toBe('a')
  })

  it('keeps a selection the backend still advertises', () => {
    // Otherwise every refetch while a conversation is open would silently drag
    // the user back to the first model.
    expect(resolveSelectedModel([model('a'), model('b')], 'b')).toBe('b')
  })

  it('falls back to the first model when the selected one is withdrawn', () => {
    expect(resolveSelectedModel([model('a'), model('c')], 'b')).toBe('a')
  })

  it('clears the selection when the configuration comes back empty', () => {
    // The select is hidden with no models, so a stale id could not be corrected
    // — and it kept the send button enabled, putting a model the backend no
    // longer advertises on the next request.
    expect(resolveSelectedModel([], 'b')).toBe('')
  })
})
