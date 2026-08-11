import { ToolApprovalPrompt } from '@/components/tool-approval-prompt'
import { ToolError } from '@/components/tool-error'
import { ToolOutputCode } from '@/components/tool-output-code'
import { ToolPartHeader } from '@/components/tool-part-header'
import { ToolSection } from '@/components/tool-section'
import { RunCodeInput } from '@/components/run-code-input'
import { isRunCodeOutput, RunCodeOutput } from '@/components/run-code-output'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { useToolFilters } from '@/contexts/tool-filters'
import { cn } from '@/lib/utils'
import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart, ToolUIPart } from 'ai'
import { EyeOffIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

// The card's left edge carries the state, so a run of cards can be scanned for
// the one that needs attention without reading a word.
const ACCENT: Partial<Record<(ToolUIPart | DynamicToolUIPart)['state'], string>> = {
  'input-available': 'border-l-primary/60',
  'approval-requested': 'border-l-amber-500',
  'output-error': 'border-l-destructive/60',
  'output-denied': 'border-l-destructive/60',
}

function stringify(value: unknown): string {
  try {
    const json: unknown = JSON.stringify(value, null, 2)
    return typeof json === 'string' ? json : String(value)
  } catch {
    return String(value)
  }
}

interface ToolPartProps {
  part: ToolUIPart | DynamicToolUIPart
  onApprovalResponse: ChatAddToolApproveResponseFunction
}

export function ToolPart({ part, onApprovalResponse }: ToolPartProps) {
  const approval = 'approval' in part ? part.approval : undefined
  const [open, setOpen] = useState(() => part.state === 'approval-requested' || Boolean(approval))
  const { addFilter } = useToolFilters()

  // Auto-open the card whenever an approval is requested — `defaultOpen` only
  // runs at mount, but the transition into `approval-requested` happens after
  // mount, so the prompt would otherwise stay collapsed.
  useEffect(() => {
    if (part.state === 'approval-requested') setOpen(true)
  }, [part.state])

  const toolName = part.type === 'dynamic-tool' ? part.toolName : part.type.split('-').slice(1).join('-')
  const isRunCode = toolName === 'run_code'
  const inputText = useMemo(() => stringify(part.input), [part.input])
  const hasOutput = part.state === 'output-available' || part.state === 'output-error'

  return (
    <Collapsible
      data-tool-name={toolName}
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'not-prose group/tool-part bg-card relative w-full overflow-hidden rounded-xl border border-l-2',
        ACCENT[part.state] ?? 'border-l-transparent',
      )}
    >
      <button
        type="button"
        aria-label="Hide this tool"
        title={`Hide ${toolName} tool cards`}
        onClick={() => {
          addFilter(toolName)
        }}
        className="text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 z-10 rounded p-1 opacity-0 transition-opacity group-hover/tool-part:opacity-100 focus-visible:opacity-100"
      >
        <EyeOffIcon className="size-3.5" />
      </button>

      <ToolPartHeader toolName={toolName} state={part.state} input={part.input} errorText={part.errorText} />

      <CollapsibleContent>
        {open && (
          <>
            {/* A call still streaming its input has none yet, and
                `JSON.stringify(undefined)` is not a string — the band rendered
                empty with a Copy button that put the word "undefined" on the
                clipboard. */}
            {part.input !== undefined &&
              (isRunCode ? (
                <RunCodeInput input={part.input} />
              ) : (
                <ToolSection label="Arguments" copyText={inputText} contentClassName="bg-muted/40">
                  <ToolOutputCode output={part.input} />
                </ToolSection>
              ))}

            {approval && (
              <ToolApprovalPrompt
                approval={approval}
                toolName={toolName}
                state={part.state}
                onApprovalResponse={onApprovalResponse}
              />
            )}

            {part.errorText && <ToolError errorText={part.errorText} />}

            {hasOutput &&
              !part.errorText &&
              (isRunCode && isRunCodeOutput(part.output) ? (
                <RunCodeOutput output={part.output} />
              ) : (
                part.output !== undefined && (
                  <ToolSection
                    label="Result"
                    copyText={stringify(part.output)}
                    contentClassName="bg-muted/40 overflow-x-auto [&_table]:w-full"
                  >
                    <ToolOutputCode output={part.output} />
                  </ToolSection>
                )
              ))}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
