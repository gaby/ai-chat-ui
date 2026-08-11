import type { ChatStatus } from 'ai'
import { FilterIcon, SlidersHorizontalIcon, SquareIcon, XIcon } from 'lucide-react'
import type { RefObject, SyntheticEvent } from 'react'

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
import { EffortSelect } from '@/components/effort-select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getToolIcon } from '@/lib/tool-icons'
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
  effort: string
  onEffortChange: (value: string) => void
  availableTools: BuiltinTool[]
  enabledTools: string[]
  onToggleTool: (id: string) => void
  onOpenFilters: () => void
  hiddenToolCount: number
  /** True while /api/configure is in flight; false once it lands or fails. */
  isLoadingModels: boolean
  /** Hidden on the welcome screen, where the suggestion chips sit in this spot. */
  showHint?: boolean
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
  showHint = true,
}: ChatComposerProps) {
  const isBusy = status === 'submitted' || status === 'streaming'

  return (
    <div className="mx-auto w-full max-w-3xl">
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
        <PromptInputToolbar>
          <PromptInputTools>
            <Tooltip>
              <TooltipTrigger asChild>
                <PromptInputButton variant="ghost" aria-label="Hidden tools" onClick={onOpenFilters}>
                  <FilterIcon className="size-4" />
                  {hiddenToolCount > 0 && <span className="text-xs tabular-nums">{hiddenToolCount}</span>}
                </PromptInputButton>
              </TooltipTrigger>
              <TooltipContent>Hidden tools</TooltipContent>
            </Tooltip>

            {availableTools.length > 0 && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <PromptInputButton variant="ghost" aria-label="Tools">
                        <SlidersHorizontalIcon className="size-4" />
                      </PromptInputButton>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Tools</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="w-60">
                  <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">Builtin tools</p>
                  {availableTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="hover:bg-accent flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2 py-1.5"
                      onClick={() => {
                        onToggleTool(tool.id)
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {getToolIcon(tool.id)}
                        <span className="text-sm">{tool.name}</span>
                      </div>
                      <Switch
                        aria-label={tool.name}
                        checked={enabledTools.includes(tool.id)}
                        onCheckedChange={() => {
                          onToggleTool(tool.id)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                      />
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Active tools read as pills rather than a count behind a menu:
                what the next message will run with should be visible without
                opening anything. */}
            {enabledTools.map((id) => {
              const tool = availableTools.find((entry) => entry.id === id)
              if (!tool) return null
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onToggleTool(id)
                  }}
                  aria-label={`Turn off ${tool.name}`}
                  className="border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15 flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm"
                >
                  {getToolIcon(tool.id, 'size-3.5 text-primary')}
                  <span className="max-w-28 truncate">{tool.name}</span>
                  <XIcon className="text-muted-foreground size-3" />
                </button>
              )
            })}

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

            <EffortSelect value={effort} onValueChange={onEffortChange} />
          </PromptInputTools>

          {/* While a run is in flight the submit button is disabled (there is no
              draft to send), which used to leave no way to stop it. Swap it for
              a real stop control instead. */}
          {isBusy ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <PromptInputSubmit type="button" aria-label="Stop generating" onClick={onStop}>
                  <SquareIcon className="size-4 fill-current" />
                </PromptInputSubmit>
              </TooltipTrigger>
              <TooltipContent>Stop generating</TooltipContent>
            </Tooltip>
          ) : (
            <PromptInputSubmit disabled={!input.trim()} status={status} aria-label="Send message" />
          )}
        </PromptInputToolbar>
      </PromptInput>

      {showHint && (
        <p className="text-muted-foreground mt-2 hidden text-center text-xs sm:block">
          <kbd className="font-sans">Enter</kbd> to send &middot; <kbd className="font-sans">Shift</kbd> +{' '}
          <kbd className="font-sans">Enter</kbd> for a new line
        </p>
      )}
    </div>
  )
}
