import { ChevronRightIcon, LightbulbIcon } from 'lucide-react'

import { ReasoningTrace } from '@/components/reasoning-trace'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useStreamingDisclosure } from '@/hooks/useStreamingDisclosure'
import { cn } from '@/lib/utils'

/**
 * The model's thinking, folded away behind one quiet line.
 *
 * Reasoning is context, not the answer, so at rest it is a single muted row —
 * no card, no border, nothing competing with the reply underneath. It opens
 * itself while the model is thinking (that is when the stream is worth
 * watching) and folds back up once the answer arrives.
 */
export function ReasoningBlock({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const { open, onOpenChange, duration } = useStreamingDisclosure({ isStreaming })

  const label = isStreaming ? 'Thinking' : duration > 0 ? `Thought for ${duration}s` : 'Thinking completed'

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="not-prose w-full">
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
