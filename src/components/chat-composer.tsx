import type { ChatStatus } from 'ai'
import { FilterIcon, SlidersHorizontalIcon, SquareIcon } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
}: ChatComposerProps) {
  const isBusy = status === 'submitted' || status === 'streaming'

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PromptInput onSubmit={onSubmit} className="ring-primary/25 rounded-2xl shadow-sm">
        <PromptInputTextarea
          className="px-3.5 py-3"
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
                        {enabledTools.length > 0 && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[0.625rem] tabular-nums">
                            {enabledTools.length}
                          </Badge>
                        )}
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

      <p className="text-muted-foreground mt-2 hidden text-center text-xs sm:block">
        <kbd className="font-sans">Enter</kbd> to send &middot; <kbd className="font-sans">Shift</kbd> +{' '}
        <kbd className="font-sans">Enter</kbd> for a new line
      </p>
    </div>
  )
}
