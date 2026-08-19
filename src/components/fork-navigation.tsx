import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

import { useForkSiblings } from '@/hooks/useForkSiblings'

/**
 * Step between the forks made at one point in a conversation. Renders nothing
 * unless this message actually has siblings.
 */
export function ForkNavigation({
  conversationId,
  messageIndex,
  onNavigate,
}: {
  conversationId: string
  messageIndex: number
  onNavigate: (conversationId: string) => void
}) {
  const { siblings, currentIndex, total } = useForkSiblings(conversationId, messageIndex)

  if (total <= 1) return null

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        disabled={currentIndex === 0}
        onClick={() => {
          onNavigate(siblings[currentIndex - 1].id)
        }}
        aria-label="Previous fork"
      >
        <ChevronLeftIcon className="size-3.5" />
      </button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {currentIndex + 1}/{total}
      </span>
      <button
        type="button"
        className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        disabled={currentIndex === total - 1}
        onClick={() => {
          onNavigate(siblings[currentIndex + 1].id)
        }}
        aria-label="Next fork"
      >
        <ChevronRightIcon className="size-3.5" />
      </button>
    </div>
  )
}
