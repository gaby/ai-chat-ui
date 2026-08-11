import { Actions, Action } from '@/components/ai-elements/actions'
import { Response } from '@/components/ai-elements/response'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, RefreshCcwIcon, XIcon } from 'lucide-react'
import type { ChatAddToolApproveResponseFunction, UIDataTypes, UIMessagePart, UITools, UIMessage } from 'ai'
import { useEffect, useState } from 'react'
import { useForkSiblings } from '@/hooks/useForkSiblings'
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning'
import { CopyButton } from '@/components/copy-button'
import { MessageUsage } from '@/components/message-usage'
import { ToolPart } from '@/components/tool-part'
import { UserBubble } from '@/components/user-bubble'

interface PartProps {
  part: UIMessagePart<UIDataTypes, UITools>
  message: UIMessage
  status: string
  regen: (id: string) => void
  index: number
  lastMessage: boolean
  onApprovalResponse: ChatAddToolApproveResponseFunction
  isEditing?: boolean
  editDraft?: string
  onStartEdit?: (messageId: string) => void
  onCancelEdit?: (messageId: string, draft: string) => void
  onSubmitEdit?: (messageId: string, newText: string) => void
  conversationId?: string
  messageIndex?: number
  onNavigateToFork?: (conversationId: string) => void
}

export function Part({
  part,
  message,
  status,
  regen,
  index,
  lastMessage,
  onApprovalResponse,
  isEditing,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  conversationId,
  messageIndex,
  onNavigateToFork,
}: PartProps) {
  const [editText, setEditText] = useState('')

  // Intentionally deps on [isEditing] only — we want to initialize editText
  // from draft/part.text only when entering edit mode, not on subsequent changes
  useEffect(() => {
    if (isEditing && part.type === 'text') {
      setEditText(editDraft ?? part.text)
    }
  }, [isEditing])

  if (part.type === 'text') {
    if (message.role === 'user' && isEditing) {
      return (
        <div className="py-3">
          <UserBubble className="w-full max-w-full sm:max-w-full">
            <textarea
              className="min-h-[60px] w-full resize-none bg-transparent text-sm outline-none"
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSubmitEdit?.(message.id, editText)
                } else if (e.key === 'Escape') {
                  onCancelEdit?.(message.id, editText)
                }
              }}
              autoFocus
            />
          </UserBubble>
          <Actions className="mt-1 justify-end">
            <Action
              onClick={() => {
                onSubmitEdit?.(message.id, editText)
              }}
              label="Submit edit"
              tooltip="Submit edit"
              className="text-primary hover:text-primary"
            >
              <CheckIcon className="size-3.5" />
            </Action>
            <Action
              onClick={() => {
                onCancelEdit?.(message.id, editText)
              }}
              label="Cancel edit"
              tooltip="Cancel edit"
              className="text-destructive hover:text-destructive"
            >
              <XIcon className="size-3.5" />
            </Action>
          </Actions>
        </div>
      )
    }

    if (message.role === 'user') {
      return (
        <div className="py-3">
          <UserBubble>
            <Response>{part.text}</Response>
          </UserBubble>
          {index === message.parts.length - 1 && (
            <div className="mt-1 flex items-center justify-end gap-2">
              {status !== 'submitted' && status !== 'streaming' && (
                <Actions className="opacity-0 transition-opacity group-hover/user-message:opacity-100 focus-within:opacity-100">
                  <Action
                    onClick={() => {
                      onStartEdit?.(message.id)
                    }}
                    label="Edit message"
                    tooltip="Edit message"
                  >
                    <PencilIcon className="size-3.5" />
                  </Action>
                  <CopyButton text={part.text} label="Copy message" />
                </Actions>
              )}
              {conversationId && messageIndex !== undefined && onNavigateToFork && (
                <ForkNavigation
                  conversationId={conversationId}
                  messageIndex={messageIndex}
                  onNavigate={onNavigateToFork}
                />
              )}
            </div>
          )}
        </div>
      )
    }

    // Assistant prose runs full width with no bubble: tool cards, code blocks
    // and tables in the same turn then share one column and one measure.
    return (
      <div>
        <Response className="text-[0.9375rem] leading-7">{part.text}</Response>
        {index === message.parts.length - 1 && (
          <Actions className="-ml-2 opacity-0 transition-opacity group-hover/assistant:opacity-100 focus-within:opacity-100">
            <Action
              onClick={() => {
                regen(message.id)
              }}
              label="Regenerate response"
              tooltip="Regenerate"
            >
              <RefreshCcwIcon className="size-3.5" />
            </Action>
            <CopyButton text={part.text} label="Copy response" />
            <MessageUsage message={message} />
          </Actions>
        )}
      </div>
    )
  } else if (part.type === 'reasoning') {
    return (
      <Reasoning
        className="bg-muted/40 mb-0 w-full rounded-xl border px-3 py-2"
        isStreaming={status === 'streaming' && index === message.parts.length - 1 && lastMessage}
      >
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    )
  } else if (part.type === 'dynamic-tool' || 'toolCallId' in part) {
    return <ToolPart part={part} onApprovalResponse={onApprovalResponse} />
  }
}

function ForkNavigation({
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
