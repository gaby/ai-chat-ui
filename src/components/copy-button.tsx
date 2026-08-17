import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { MessageAction } from '@/components/message-action'
import { isRecord } from '@/lib/is-record'

const RESET_DELAY = 1500

/**
 * `navigator.clipboard` when there is really one there.
 *
 * It is typed as always present but is absent outside a secure context, and the
 * offline artifact is meant to be served over plain http — where reading
 * `.writeText` off it throws synchronously, past any `.catch` on the promise it
 * never returns.
 */
function availableClipboard(): Clipboard | undefined {
  const api: unknown = navigator.clipboard
  return isRecord(api) && typeof api.writeText === 'function' ? navigator.clipboard : undefined
}

/**
 * Copy action that confirms itself: without the tick, a click on a silent icon
 * gives no sign the clipboard actually took the text.
 */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const copy = () => {
    const clipboard = availableClipboard()
    if (!clipboard) {
      toast.error('Copying needs a secure (https) connection.')
      return
    }
    clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          setCopied(false)
        }, RESET_DELAY)
      })
      .catch((error: unknown) => {
        console.error('Error copying text:', error)
      })
  }

  return (
    <MessageAction label={copied ? 'Copied' : label} onClick={copy}>
      {copied ? <CheckIcon className="text-primary size-3.5" /> : <CopyIcon className="size-3.5" />}
    </MessageAction>
  )
}
