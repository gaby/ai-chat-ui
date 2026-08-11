import { ChevronRightIcon, LightbulbIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ReasoningTrace } from '@/components/reasoning-trace'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

// Long enough to notice the thinking finished, short enough not to sit in the
// way of the answer.
const AUTO_COLLAPSE_DELAY = 1000

/**
 * The model's thinking, folded away behind one quiet line.
 *
 * Reasoning is context, not the answer, so at rest it is a single muted row —
 * no card, no border, nothing competing with the reply underneath. It opens
 * itself while the model is thinking (that is when the stream is worth
 * watching) and folds back up once the answer arrives.
 */
export function ReasoningBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [open, setOpen] = useState(isStreaming)
  const [duration, setDuration] = useState(0)
  const startedAt = useRef<number | null>(null)
  const hasAutoCollapsed = useRef(false)
  const userToggled = useRef(false)

  // Timing and auto-collapse share one effect deliberately: they both key off
  // the same transition, and splitting them let the first clear `startedAt`
  // before the second could read it.
  useEffect(() => {
    if (isStreaming) {
      startedAt.current ??= Date.now()
      setOpen(true)
      return
    }

    // Nothing streamed in this session — a conversation loaded from storage
    // starts collapsed and stays wherever the reader puts it.
    if (startedAt.current === null) return

    setDuration(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)))
    startedAt.current = null

    // Not once it has already folded itself, and not over someone who opened it
    // — reopening during the grace period used to be undone a moment later.
    if (hasAutoCollapsed.current || userToggled.current) return
    const timer = setTimeout(() => {
      if (userToggled.current) return
      setOpen(false)
      hasAutoCollapsed.current = true
    }, AUTO_COLLAPSE_DELAY)
    return () => {
      clearTimeout(timer)
    }
  }, [isStreaming])

  const label = isStreaming ? 'Thinking' : duration > 0 ? `Thought for ${duration}s` : 'Thinking completed'

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        userToggled.current = true
        setOpen(next)
      }}
      className="not-prose w-full"
    >
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1.5 text-sm transition-colors">
        <LightbulbIcon className={cn('size-4', isStreaming && 'text-primary animate-pulse')} />
        <span className={cn(isStreaming && 'animate-pulse')}>{label}</span>
        <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 overflow-hidden">
        <ReasoningTrace text={text} isStreaming={isStreaming} />
      </CollapsibleContent>
    </Collapsible>
  )
}
