import { AlertTriangleIcon, ArrowRightIcon, ChevronRightIcon, RefreshCcwIcon } from 'lucide-react'
import { useState } from 'react'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// Anything longer than a sentence is a provider dump, not a message a person
// reads at a glance; it moves behind the details toggle.
const SUMMARY_LENGTH = 140

/**
 * A run that failed.
 *
 * The failure is separated from the recovery: what went wrong reads as one
 * plain line, the provider's raw text is one click away for whoever needs it,
 * and the two ways forward sit where the eye lands last.
 */
export function ChatError({
  message,
  onRetry,
  onContinue,
}: {
  message: string
  onRetry: () => void
  onContinue: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const trimmed = message.trim()
  const firstLine = trimmed.split('\n')[0]
  const hasMore = trimmed.length > firstLine.length
  // Only ellipsize when the first line itself was cut — appending one to a
  // sentence that already ended read as "Unavailable....".
  const summary = firstLine.length > SUMMARY_LENGTH ? firstLine.slice(0, SUMMARY_LENGTH).trimEnd() + '…' : firstLine

  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 animate-message-in my-2 overflow-hidden rounded-xl border"
    >
      <div className="flex gap-3 p-4">
        <AlertTriangleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">The run didn&apos;t finish</p>
          <p className="text-muted-foreground mt-1 text-sm break-words">
            {summary || 'The agent stopped without returning a reply.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCcwIcon className="size-3.5" />
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={onContinue}>
              <ArrowRightIcon className="size-3.5" />
              Continue
            </Button>
            <span className="ml-auto">
              <CopyButton text={trimmed} label="Copy error" />
            </span>
          </div>
        </div>
      </div>

      {hasMore && (
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground hover:bg-destructive/5 group flex w-full items-center gap-1.5 border-t px-4 py-2 text-xs transition-colors">
            <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
            Details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-muted-foreground max-h-64 overflow-auto border-t px-4 py-3 font-mono text-xs break-words whitespace-pre-wrap">
              {trimmed}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
