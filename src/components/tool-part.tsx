import { Tool, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import { ToolApprovalPrompt } from '@/components/tool-approval-prompt'
import { ToolPartHeader } from '@/components/tool-part-header'
import { ToolOutputCode } from '@/components/tool-output-code'
import { RunCodeInput } from '@/components/run-code-input'
import { isRunCodeOutput, RunCodeOutput } from '@/components/run-code-output'
import { useToolFilters } from '@/contexts/tool-filters'
import type { ChatAddToolApproveResponseFunction, DynamicToolUIPart, ToolUIPart } from 'ai'
import { EyeOffIcon } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

// Memoize to avoid re-running highlighters on unchanged code.
const ToolInputMemo = memo(ToolInput)

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
  // mount, so the Confirmation prompt would otherwise stay collapsed.
  useEffect(() => {
    if (part.state === 'approval-requested') setOpen(true)
  }, [part.state])

  const toolName = part.type === 'dynamic-tool' ? part.toolName : part.type.split('-').slice(1).join('-')
  const isRunCode = toolName === 'run_code'

  return (
    <Tool
      data-tool-name={toolName}
      open={open}
      onOpenChange={setOpen}
      className="group/tool-part bg-card relative mb-0 rounded-xl"
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
      <ToolPartHeader toolName={toolName} state={part.state} input={part.input} />
      <ToolContent>
        {open && (
          <>
            {isRunCode ? <RunCodeInput input={part.input} /> : <ToolInputMemo input={part.input} />}
            {approval && (
              <ToolApprovalPrompt approval={approval} state={part.state} onApprovalResponse={onApprovalResponse} />
            )}
            {(part.state === 'output-available' || part.state === 'output-error') &&
              (isRunCode && !part.errorText && isRunCodeOutput(part.output) ? (
                <RunCodeOutput output={part.output} />
              ) : (
                <ToolOutput errorText={part.errorText} output={<ToolOutputCode output={part.output} />} />
              ))}
          </>
        )}
      </ToolContent>
    </Tool>
  )
}
