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
 */
export function Markdown(props: ComponentProps<typeof Response>) {
  return <Response rehypePlugins={rehypePlugins} {...props} />
}
