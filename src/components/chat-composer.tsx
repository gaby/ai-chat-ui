import type { ChatStatus } from 'ai'
import { FilterIcon, SquareIcon } from 'lucide-react'
import type { ReactNode, RefObject, SyntheticEvent } from 'react'

import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { EffortMeter } from '@/components/effort-meter'
import { ToolToggleBar } from '@/components/tool-toggle-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ThinkingEffort } from '@/lib/generated/thinking-effort.gen'
import type { BuiltinTool, ModelConfig } from '@/types'

interface ChatComposerProps {
  input: string
  onInputChange: (value: string) => void
  onSubmit: (event: SyntheticEvent) => void
  onStop: () => void
  status: ChatStatus
  textareaRef: RefObject<HTMLTextAreaElement | null>
  models: ModelConfig[]
  model: string
  onModelChange: (value: string) => void
  effort: ThinkingEffort
  onEffortChange: (value: ThinkingEffort) => void
  availableTools: BuiltinTool[]
  enabledTools: string[]
  onToggleTool: (id: string) => void
  onOpenFilters: () => void
  hiddenToolCount: number
  /** True while /api/configure is in flight; false once it lands or fails. */
  isLoadingModels: boolean
  /** Token usage for the conversation, shown alongside the keyboard hint. */
  usage?: ReactNode
  /** Hidden on the welcome screen, where the suggestion chips sit in this spot. */
  showHint?: boolean
  /**
   * False while the conversation's history has not arrived. Sending then would
   * go out without it, and the reply would be saved over what failed to load.
   */
  canSend?: boolean
}

/**
 * The composer: message box plus the run settings that apply to the next
 * message (model, thinking effort, builtin tools) and the filter escape hatch.
 */
export function ChatComposer({
  input,
  onInputChange,
  onSubmit,
  onStop,
  status,
  textareaRef,
  models,
  model,
  onModelChange,
  effort,
  onEffortChange,
  availableTools,
  enabledTools,
  onToggleTool,
  onOpenFilters,
  hiddenToolCount,
  isLoadingModels,
  usage,
  showHint = true,
  canSend = true,
}: ChatComposerProps) {
  const isBusy = status === 'submitted' || status === 'streaming'

  return (
    // `px-4` matches `ConversationContent`, so the composer's border sits on the
    // same left and right edges as the messages above it. Without it the
    // composer was 16px wider on each side — a visible step between the box you
    // type into and the column it lands in.
    <div className="mx-auto w-full max-w-3xl px-4">
      <PromptInput onSubmit={onSubmit} className="ring-primary/25 rounded-2xl shadow-sm">
        <PromptInputTextarea
          // The vendored Textarea floors at min-h-16, which left a band of dead
          // space under a one-line draft; grow from a single line instead.
          className="min-h-11 px-3.5 py-3"
          ref={textareaRef}
          onChange={(e) => {
            onInputChange(e.target.value)
          }}
          value={input}
          autoFocus={true}
        />
        <PromptInputToolbar className="gap-2">
          {/* The run controls scroll sideways on a narrow screen instead of
              pushing the send button off the edge. */}
          <PromptInputTools className="no-scrollbar min-w-0 flex-1 overflow-x-auto [&>*]:shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <PromptInputButton variant="ghost" aria-label="Hidden tools" onClick={onOpenFilters}>
                  <FilterIcon className="size-4" />
                  {hiddenToolCount > 0 && <span className="text-xs tabular-nums">{hiddenToolCount}</span>}
                </PromptInputButton>
              </TooltipTrigger>
              <TooltipContent>Hidden tools</TooltipContent>
            </Tooltip>

            <ToolToggleBar tools={availableTools} enabled={enabledTools} onToggle={onToggleTool} />

            {/* Hold the model select's footprint while /api/configure is in
                flight, so the toolbar does not jump once it lands. */}
            {isLoadingModels && <Skeleton className="h-8 w-24 rounded-lg" />}

            {models.length > 0 && model && (
              <PromptInputModelSelect onValueChange={onModelChange} value={model}>
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {models.map((entry) => (
                    <PromptInputModelSelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </PromptInputModelSelectItem>
                  ))}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            )}

            <EffortMeter value={effort} onValueChange={onEffortChange} />
          </PromptInputTools>

          {/* While a run is in flight the submit button is disabled (there is no
              draft to send), which used to leave no way to stop it. Swap it for
              a real stop control instead. */}
          {isBusy ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <PromptInputSubmit type="button" aria-label="Stop generating" onClick={onStop} className="shrink-0">
                  <SquareIcon className="size-4 fill-current" />
                </PromptInputSubmit>
              </TooltipTrigger>
              <TooltipContent>Stop generating</TooltipContent>
            </Tooltip>
          ) : (
            // `status` is deliberately not forwarded: the busy states are handled
            // above, and the only one left that the button reacts to is `error`,
            // which swaps the paper plane for an X. The failure already has a card
            // of its own with Retry and Continue on it — a red X on the send
            // button reads as "cancel", on a control that still sends.
            <PromptInputSubmit
              disabled={!input.trim() || !model || !canSend}
              aria-label="Send message"
              className="shrink-0"
            />
          )}
        </PromptInputToolbar>
      </PromptInput>

      {/* Hint centred, usage pinned right: a three-column grid keeps the hint
          centred on the composer even when the usage chip is present. */}
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span />
        {showHint ? (
          <p className="text-muted-foreground hidden text-center text-xs sm:block">
            <kbd className="font-sans">Enter</kbd> to send &middot; <kbd className="font-sans">Shift</kbd> +{' '}
            <kbd className="font-sans">Enter</kbd> for a new line
          </p>
        ) : (
          <span />
        )}
        <div className="justify-self-end">{usage}</div>
      </div>
    </div>
  )
}
