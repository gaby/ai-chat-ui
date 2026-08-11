import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { MessageAction } from '@/components/message-action'

const RESET_DELAY = 1500

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
    navigator.clipboard
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
