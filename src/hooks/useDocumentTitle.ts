import { useEffect } from 'react'

// Read once, before anything overwrites it: whatever the host page shipped in
// its <title> is the app name we suffix conversation titles with.
const BASE_TITLE = typeof document === 'undefined' ? '' : document.title

/**
 * Reflect the active conversation in the tab title, so several agent runs open
 * side by side stay tellable apart.
 */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE
  }, [title])
}
