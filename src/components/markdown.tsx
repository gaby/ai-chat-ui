import { type ComponentProps } from 'react'

import { Response } from '@/components/ai-elements/response'
import { rehypePlugins } from '@/lib/markdown-plugins'

/**
 * Model-authored markdown, rendered the way this app renders it.
 *
 * A thin wrapper over the vendored `Response` so the corrected rehype pipeline
 * (see `lib/markdown-plugins.ts`) is not something each call site has to
 * remember — a message rendered through the bare primitive would silently go
 * back to garbled math.
 *
 * `rehypePlugins` is off the prop list on purpose: Streamdown replaces the list
 * wholesale, so a call site passing its own would drop sanitisation from a
 * component that renders untrusted model output. Rejecting it at the type level
 * keeps that from being a thing anyone can do by accident.
 */
export function Markdown(props: Omit<ComponentProps<typeof Response>, 'rehypePlugins'>) {
  return <Response {...props} rehypePlugins={rehypePlugins} />
}
