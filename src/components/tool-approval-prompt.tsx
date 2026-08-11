import type { ChatAddToolApproveResponseFunction, ToolUIPart } from 'ai'
import { CheckIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldXIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ToolApprovalPromptProps {
  approval: { id: string; approved?: boolean }
  toolName: string
  state: ToolUIPart['state']
  onApprovalResponse: ChatAddToolApproveResponseFunction
}

// Every state a decided approval can be sitting in. `output-error` belongs here
// too: an approved tool that then fails still carries `approval.approved`, and
// leaving it out made the record of the decision vanish at exactly the moment
// someone would go looking for who let the call through.
const RESOLVED_STATES: ToolUIPart['state'][] = [
  'approval-responded',
  'output-available',
  'output-error',
  'output-denied',
]

/**
 * The gate in front of a tool that needs a human decision.
 *
 * This is the one moment in a run where the agent stops and the answer is the
 * user's, so it does not read like the rest of the card: it names the tool it
 * is asking about, states plainly that nothing has run yet, and puts the two
 * outcomes side by side with the safe one reachable first.
 */
export function ToolApprovalPrompt({ approval, toolName, state, onApprovalResponse }: ToolApprovalPromptProps) {
  if (state === 'approval-requested') {
    return (
      <div className="border-t border-amber-500/25 bg-amber-500/5 px-3 py-3">
        <div className="flex gap-2.5">
          <ShieldAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">This tool requires your approval to run</p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              <span className="font-mono text-xs">{toolName}</span> has not run yet. Review the arguments above before
              deciding.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  void onApprovalResponse({ id: approval.id, approved: true })
                }}
              >
                <CheckIcon className="size-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  void onApprovalResponse({ id: approval.id, approved: false })
                }}
              >
                Deny
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!RESOLVED_STATES.includes(state) || approval.approved === undefined) return null

  // Once decided, the outcome shrinks to a single line: it is a record of what
  // was chosen, not something that still needs attention.
  return approval.approved ? (
    <p className="text-muted-foreground flex items-center gap-1.5 border-t px-3 py-2 text-xs">
      <ShieldCheckIcon className="text-primary size-3.5 shrink-0" />
      {state === 'approval-responded' ? 'Approved. Executing tool…' : 'Approved by you.'}
    </p>
  ) : (
    <p className="text-muted-foreground flex items-center gap-1.5 border-t px-3 py-2 text-xs">
      <ShieldXIcon className="text-destructive size-3.5 shrink-0" />
      Denied. Tool will not run.
    </p>
  )
}
