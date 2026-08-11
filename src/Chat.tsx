import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources'
import { AssistantTurn } from '@/components/assistant-turn'
import { ChatComposer } from '@/components/chat-composer'
import { ChatError } from '@/components/chat-error'
import { ConfigErrorBanner } from '@/components/config-error-banner'
import { EditMessageDialog } from '@/components/edit-message-dialog'
import { HiddenToolsGroup } from '@/components/hidden-tools-group'
import { ThinkingIndicator } from '@/components/thinking-indicator'
import { ToolCallGroup } from '@/components/tool-call-group'
import { ToolFiltersDialog } from '@/components/tool-filters-dialog'
import { UsageSummary } from '@/components/usage-summary'
import { WelcomeScreen } from '@/components/welcome-screen'
import { ToolFiltersProvider, useToolFilters } from '@/contexts/tool-filters'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react'

import { toast } from 'sonner'

import { useQuery } from '@tanstack/react-query'
import { useThrottle } from '@uidotdev/usehooks'
import { nanoid } from 'nanoid'
import { useConversationIdFromUrl } from './hooks/useConversationIdFromUrl'
import { Part } from './Part'
import type { ThinkingEffort } from '@/lib/generated/thinking-effort.gen'
import type { BuiltinTool, ConversationEntry, ModelConfig } from './types'
import { readEffort, writeEffort } from '@/lib/effort'
import { toolNameOfPart } from '@/lib/tool-filters'
import { COMPLETE_TOOL_STATES, groupParts } from '@/lib/tool-grouping'
import { getMessages, saveMessages, saveConversation } from '@/lib/chat-db'
import { stripBasePath } from '@/lib/base-path'

// TODO: if just a single model, don't show model selector, just a label.
interface RemoteConfig {
  models: ModelConfig[]
  builtinTools: BuiltinTool[]
}

async function getModels() {
  const res = await fetch('/api/configure')
  return (await res.json()) as RemoteConfig
}

const ChatInner = () => {
  const { isFiltered, filters } = useToolFilters()
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false)
  const [input, setInput] = useState('')
  const [model, setModel] = useState('')
  const [effort, setEffort] = useState<ThinkingEffort>(() => readEffort())
  const [enabledTools, setEnabledTools] = useState<string[]>([])
  const modelRef = useRef(model)
  modelRef.current = model
  const effortRef = useRef(effort)
  effortRef.current = effort
  const enabledToolsRef = useRef(enabledTools)
  enabledToolsRef.current = enabledTools

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        body: () => ({ model: modelRef.current, builtinTools: enabledToolsRef.current, effort: effortRef.current }),
      }),
  )
  const { messages, sendMessage, status, setMessages, regenerate, error, clearError, addToolApprovalResponse, stop } =
    useChat({
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    })
  const [conversationId, setConversationId] = useConversationIdFromUrl()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // `stop` is not referentially stable, and the conversation-change effect must
  // not re-run just because a new one arrived.
  const stopRef = useRef(stop)
  stopRef.current = stop

  // Set when a send creates a conversation, so the id change it triggers is not
  // mistaken for navigating away from one.
  const createdHereRef = useRef<string | null>(null)

  // Which conversation the mounted messages belong to — '/' for a new chat,
  // null while a stored one is still being read.
  const [loadedConversationId, setLoadedConversationId] = useState<string | null>(conversationId === '/' ? '/' : null)

  // Snapshots are tagged with the conversation the messages belong to, not with
  // `conversationId` — that runs ahead of the messages while a switch is in
  // flight, and keying the save off it wrote one conversation's history into
  // another.
  const snapshot = useMemo(() => ({ id: loadedConversationId, messages }), [loadedConversationId, messages])
  const throttled = useThrottle(snapshot, 500)

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const editDraftsRef = useRef(new Map<string, string>())
  const [pendingEdit, setPendingEdit] = useState<{ messageId: string; text: string } | null>(null)
  // Deferred send: set this ref, then call setMessages. The useEffect below
  // will fire sendMessage after the messages state has been committed.
  const pendingSendRef = useRef<{ text: string; model: string; builtinTools: string[] } | null>(null)
  const [sendTrigger, setSendTrigger] = useState(0)

  const configQuery = useQuery({
    queryFn: getModels,
    queryKey: ['models'],
  })

  useEffect(() => {
    // A backend with no providers configured returns an empty list; the composer
    // degrades to a disabled model select rather than the chat crashing here.
    const firstModel = configQuery.data?.models[0]
    if (firstModel) {
      setModel(firstModel.id)
    }
  }, [configQuery.data])

  // Builtin tools are advertised per model, so a tool enabled on one model must
  // not keep riding along on a model that does not offer it — the chip that
  // would switch it off is gone from the toolbar by then.
  useEffect(() => {
    const allowed = configQuery.data?.models.find((entry) => entry.id === model)?.builtinTools ?? []
    setEnabledTools((prev) => {
      const next = prev.filter((id) => allowed.includes(id))
      return next.length === prev.length ? prev : next
    })
  }, [configQuery.data, model])

  useEffect(() => {
    setEditingMessageId(null)

    // The conversation this session just created: the messages already in
    // memory are its own, and a run is streaming into it. Neither clear nor
    // stop applies.
    if (createdHereRef.current === conversationId) {
      createdHereRef.current = null
      setLoadedConversationId(conversationId)
      return
    }

    // Abandon any run still streaming into the conversation we are leaving.
    // Without this the SDK keeps appending its chunks, and they land in
    // whichever conversation is now on screen.
    void stopRef.current()
    // Clear first either way: leaving the old messages mounted while the read is
    // in flight shows the previous conversation under this one's title, and the
    // save effect would then persist them under this id.
    setMessages([])
    setLoadedConversationId(conversationId === '/' ? '/' : null)

    if (conversationId !== '/') {
      getMessages(conversationId)
        .then((storedMessages) => {
          setMessages(storedMessages ?? [])
          setLoadedConversationId(conversationId)

          // Auto-send pending fork message after loading forked conversation
          // Uses deferred send to ensure setMessages is committed first
          if (pendingSendRef.current) {
            setSendTrigger((n) => n + 1)
          }
        })
        .catch((err: unknown) => {
          console.error('Failed to load messages:', err)
          toast.error('Failed to load this conversation from browser storage.')
        })
    }
    textareaRef.current?.focus()
  }, [conversationId])

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // we're starting a new conversation
    if (stripBasePath(window.location.pathname) === '/') {
      const newConversationId = `/${nanoid()}`
      createdHereRef.current = newConversationId
      // `setConversationId` pushes the URL itself; pushing again here left two
      // identical history entries, so Back appeared to do nothing.
      setConversationId(newConversationId)
      saveConversationEntry(newConversationId, input)
    }

    // A run stopped mid tool-call leaves a tool part with no output, and
    // pydantic-ai rejects an orphaned tool call — same cleanup `handleContinue`
    // does, which the plain send path was missing.
    const lastMessage = messages.at(-1)
    if (lastMessage?.role === 'assistant' && hasIncompleteToolPart(lastMessage.parts)) {
      pendingSendRef.current = { text: input, model, builtinTools: enabledTools }
      setMessages(messages.slice(0, -1))
      setTimeout(() => {
        setSendTrigger((n) => n + 1)
      }, 0)
      setInput('')
      return
    }

    sendMessage({ text: input }).catch((error: unknown) => {
      console.error('Error sending message:', error)
    })
    setInput('')
  }

  // Fires deferred sendMessage after setMessages has been committed
  useEffect(() => {
    if (!pendingSendRef.current) return
    const pending = pendingSendRef.current
    pendingSendRef.current = null
    sendMessage({ text: pending.text }).catch((error: unknown) => {
      console.error('Error sending deferred message:', error)
    })
  }, [sendTrigger])

  useEffect(() => {
    const { id, messages: pending } = throttled
    if (id !== null && id !== '/' && pending.length > 0) {
      saveMessages(id, pending).catch((err: unknown) => {
        console.error('Failed to save messages:', err)
      })
    }
  }, [throttled])

  const handleStartEdit = useCallback((messageId: string) => {
    setEditingMessageId(messageId)
  }, [])

  const handleCancelEdit = useCallback((messageId: string, draft: string) => {
    editDraftsRef.current.set(messageId, draft)
    setEditingMessageId(null)
  }, [])

  const handleSubmitEdit = useCallback(
    (messageId: string, newText: string) => {
      const original = messages.find((m) => m.id === messageId)
      const originalText = original?.parts.find((p) => p.type === 'text')
      const unchanged = originalText && 'text' in originalText && originalText.text === newText

      editDraftsRef.current.delete(messageId)
      setEditingMessageId(null)

      if (unchanged) return

      setPendingEdit({ messageId, text: newText })
    },
    [messages],
  )

  const handleModify = useCallback(() => {
    if (!pendingEdit) return
    const messageIndex = messages.findIndex((m) => m.id === pendingEdit.messageId)
    if (messageIndex === -1) return

    pendingSendRef.current = { text: pendingEdit.text, model, builtinTools: enabledTools }
    setMessages(messages.slice(0, messageIndex))
    setPendingEdit(null)
    // Defer to next macrotask so setMessages commits before the send effect fires
    setTimeout(() => {
      setSendTrigger((n) => n + 1)
    }, 0)
  }, [pendingEdit, messages, setMessages, model, enabledTools])

  // Retry: re-run the last user message, discarding everything generated after
  // it (partial assistant text, in-progress tool parts, whole tool-loop turns).
  const handleRetry = useCallback(() => {
    let i = messages.length - 1
    while (i >= 0 && messages[i].role !== 'user') i--
    if (i === -1) return

    const userMessage = messages[i]
    const textPart = userMessage.parts.find((p) => p.type === 'text')
    const text = textPart && 'text' in textPart ? textPart.text : ''

    clearError()
    pendingSendRef.current = { text, model, builtinTools: enabledTools }
    // Drop the user message too; the deferred send re-adds it cleanly.
    setMessages(messages.slice(0, i))
    setTimeout(() => {
      setSendTrigger((n) => n + 1)
    }, 0)
  }, [messages, clearError, setMessages, model, enabledTools])

  // Continue: append a `continue` user message to a valid history. If the run
  // errored mid-tool-call, the trailing assistant message may hold a tool part
  // with no output; pydantic-ai rejects an orphaned tool call, so drop that
  // trailing assistant message first.
  const handleContinue = useCallback(() => {
    const lastMessage = messages.at(-1)
    if (lastMessage?.role === 'assistant' && hasIncompleteToolPart(lastMessage.parts)) {
      clearError()
      pendingSendRef.current = { text: 'continue', model, builtinTools: enabledTools }
      setMessages(messages.slice(0, -1))
      setTimeout(() => {
        setSendTrigger((n) => n + 1)
      }, 0)
      return
    }

    clearError()
    sendMessage({ text: 'continue' }).catch((error: unknown) => {
      console.error('Error continuing message:', error)
    })
  }, [messages, clearError, setMessages, sendMessage, model, enabledTools])

  const handleFork = useCallback(() => {
    if (!pendingEdit) return
    if (conversationId === '/') return
    const messageIndex = messages.findIndex((m) => m.id === pendingEdit.messageId)
    if (messageIndex === -1) return

    const newConversationId = `/${nanoid()}`
    const forkedMessages = messages.slice(0, messageIndex)

    // Determine first message text for the sidebar entry
    // If editing the first user message, use the new text; otherwise use the original
    const firstUserMessage = forkedMessages.find((m) => m.role === 'user')
    const firstMessageText = firstUserMessage?.parts.find((p) => p.type === 'text')
    const originalText = firstMessageText && 'text' in firstMessageText ? firstMessageText.text : undefined
    const firstMessage = originalText ?? pendingEdit.text

    // Save fork to IndexedDB
    saveConversationEntry(newConversationId, firstMessage, { conversationId, messageIndex })
    saveMessages(newConversationId, forkedMessages).catch((err: unknown) => {
      console.error('Failed to save forked messages:', err)
    })

    // Set up pending message to auto-send after navigation
    pendingSendRef.current = { text: pendingEdit.text, model, builtinTools: enabledTools }

    setPendingEdit(null)
    setConversationId(newConversationId)
  }, [pendingEdit, messages, conversationId, model, enabledTools, setConversationId])

  const handleNavigateToFork = useCallback(
    (targetConversationId: string) => {
      setConversationId(targetConversationId)
    },
    [setConversationId],
  )

  function regen(messageId: string) {
    regenerate({ messageId }).catch((error: unknown) => {
      console.error('Error regenerating message:', error)
    })
  }

  const availableTools = useMemo(() => {
    const enabledToolIds = configQuery.data?.models.find((entry) => entry.id === model)?.builtinTools ?? []
    return configQuery.data?.builtinTools.filter((tool) => enabledToolIds.includes(tool.id)) ?? []
  }, [configQuery.data, model])

  const handleToggleTool = useCallback((id: string) => {
    setEnabledTools((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]))
  }, [])

  const handleSuggestion = useCallback((prompt: string) => {
    setInput(prompt)
    const textarea = textareaRef.current
    textarea?.focus()
    // Land the caret at the end so an open-ended starter ("Explain how ") can
    // just be typed into.
    textarea?.setSelectionRange(prompt.length, prompt.length)
  }, [])

  const renderTurn = (message: UIMessage, messageIndex: number) =>
    renderMessageParts(
      message,
      (part, i) => (
        <Part
          key={`${message.id}-${i}`}
          part={part}
          message={message}
          status={status}
          index={i}
          regen={regen}
          lastMessage={message.id === messages.at(-1)?.id}
          onApprovalResponse={addToolApprovalResponse}
          isEditing={editingMessageId === message.id}
          editDraft={editDraftsRef.current.get(message.id)}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSubmitEdit={handleSubmitEdit}
          conversationId={conversationId}
          messageIndex={messageIndex}
          onNavigateToFork={handleNavigateToFork}
        />
      ),
      isFiltered,
    )

  const configBanner = configQuery.isError && (
    <ConfigErrorBanner
      isRetrying={configQuery.isFetching}
      onRetry={() => {
        configQuery.refetch().catch((error: unknown) => {
          console.error('Error reloading configuration:', error)
        })
      }}
    />
  )

  const renderComposer = (showHint: boolean) => (
    <ChatComposer
      showHint={showHint}
      usage={<UsageSummary messages={messages} />}
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      onStop={() => {
        stop().catch((error: unknown) => {
          console.error('Error stopping generation:', error)
        })
      }}
      status={status}
      textareaRef={textareaRef}
      models={configQuery.data?.models ?? []}
      model={model}
      onModelChange={setModel}
      effort={effort}
      onEffortChange={(value) => {
        setEffort(value)
        writeEffort(value)
      }}
      availableTools={availableTools}
      enabledTools={enabledTools}
      onToggleTool={handleToggleTool}
      onOpenFilters={() => {
        setFiltersDialogOpen(true)
      }}
      hiddenToolCount={filters.length}
      isLoadingModels={configQuery.isPending}
    />
  )

  const dialogs = (
    <>
      <EditMessageDialog
        open={pendingEdit !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEdit(null)
        }}
        onModify={handleModify}
        onFork={handleFork}
      />

      <ToolFiltersDialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen} />
    </>
  )

  // An empty chat opens as one centred column — greeting, composer, starting
  // points — rather than a blank page with the input pinned to the floor.
  // Gated on the conversation having finished loading, so reopening a stored
  // conversation does not flash the welcome screen before its messages arrive.
  if (messages.length === 0 && status === 'ready' && loadedConversationId === conversationId) {
    return (
      <>
        {/* `my-auto` rather than `items-center`: a centred flex child cannot be
            scrolled back to once it overflows, which clipped the heading on
            short viewports. */}
        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-8">
          <div className="my-auto w-full">
            <WelcomeScreen
              onSelect={handleSuggestion}
              composer={
                <>
                  {configBanner}
                  {renderComposer(false)}
                </>
              }
            />
          </div>
        </div>
        {dialogs}
      </>
    )
  }

  return (
    <>
      <Conversation className="h-full" aria-label="Conversation">
        <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col px-4 pt-2 pb-6">
          {messages.map((message, messageIndex) => {
            if (message.role !== 'assistant') {
              return (
                <div key={message.id} className="group/user-message">
                  {renderTurn(message, messageIndex)}
                </div>
              )
            }

            const sourceParts = message.parts.filter((part) => part.type === 'source-url')
            const isLast = message.id === messages.at(-1)?.id
            return (
              <AssistantTurn key={message.id} isStreaming={status === 'streaming' && isLast}>
                {sourceParts.length > 0 && (
                  <Sources className="mb-0">
                    <SourcesTrigger count={sourceParts.length} />
                    {sourceParts.map((part, i) => (
                      <SourcesContent key={`${message.id}-source-${i}`}>
                        <Source href={part.url} title={part.url} />
                      </SourcesContent>
                    ))}
                  </Sources>
                )}
                {renderTurn(message, messageIndex)}
              </AssistantTurn>
            )
          })}

          {status === 'submitted' && (
            <AssistantTurn>
              <ThinkingIndicator />
            </AssistantTurn>
          )}

          {status === 'error' && error && (
            // Indented to the assistant column, so a failure lines up with the
            // reply it belongs to instead of starting at the page edge.
            <div className="sm:pl-10">
              <ChatError message={error.message} onRetry={handleRetry} onContinue={handleContinue} />
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton className="bg-background shadow-md" />
      </Conversation>

      {/* The fade keeps text from colliding with the composer as it scrolls
          under the sticky footer. */}
      <div className="from-background pointer-events-none sticky bottom-0 h-6 bg-gradient-to-t to-transparent" />
      <div className="bg-background sticky bottom-0 px-3 pt-1 pb-3">
        {configBanner}
        {renderComposer(true)}
      </div>

      {dialogs}
    </>
  )
}

const Chat = () => (
  // Upstream default is an empty filter list. A host (e.g. loopy) seeds its own
  // noisy tool names by passing `defaults={[...]}` here.
  <ToolFiltersProvider defaults={[]}>
    <ChatInner />
  </ToolFiltersProvider>
)

export default Chat

// Walk a message's parts and render them, collapsing two kinds of consecutive
// runs into a single element: filtered tool parts into a `HiddenToolsGroup`, and
// runs of >=2 calls to the same (non-filtered) tool into a `ToolCallGroup`.
// `renderPart` is the per-part renderer (returns a `<Part>` element); grouping
// is message-level so it lives here rather than in `Part`. Lone calls and
// non-tool parts render unchanged.
function renderMessageParts(
  message: UIMessage,
  renderPart: (part: UIMessagePart<UIDataTypes, UITools>, index: number) => ReactNode,
  isFiltered: (toolName: string) => boolean,
): ReactNode[] {
  const descriptors = message.parts.map((part) => {
    const toolName = toolNameOfPart(part)
    return { toolName, filtered: toolName !== null && isFiltered(toolName) }
  })

  return groupParts(descriptors).map((run) => {
    if (run.kind === 'single') {
      return renderPart(message.parts[run.index], run.index)
    }
    if (run.kind === 'hidden') {
      return (
        <HiddenToolsGroup
          key={`hidden-${message.id}-${run.indices[0]}`}
          toolNames={run.indices.map((i) => toolNameOfPart(message.parts[i]) ?? '')}
        >
          {run.indices.map((i) => renderPart(message.parts[i], i))}
        </HiddenToolsGroup>
      )
    }
    return (
      <ToolCallGroup
        key={`tool-group-${message.id}-${run.indices[0]}`}
        toolName={run.toolName}
        states={run.indices.map((i) => partState(message.parts[i]))}
      >
        {run.indices.map((i) => renderPart(message.parts[i], i))}
      </ToolCallGroup>
    )
  })
}

// A tool part's lifecycle state (e.g. `output-available`). Non-tool parts have
// no state; the grouping pass never asks for theirs.
function partState(part: UIMessagePart<UIDataTypes, UITools>): string {
  return 'state' in part && typeof part.state === 'string' ? part.state : ''
}

// A tool part whose state is not in `COMPLETE_TOOL_STATES` has no output (or
// denial) yet, so continuing would leave the backend with an orphaned tool call.
function hasIncompleteToolPart(parts: UIMessagePart<UIDataTypes, UITools>[]): boolean {
  return parts.some(
    (part) => (part.type === 'dynamic-tool' || 'toolCallId' in part) && !COMPLETE_TOOL_STATES.has(part.state),
  )
}

// Long enough to make a useful header title; the sidebar truncates its own row
// with CSS rather than relying on this.
const MAX_FIRST_MESSAGE_LENGTH = 100

function saveConversationEntry(newConversationId: string, firstMessage: string, forkOf?: ConversationEntry['forkOf']) {
  const trimmedFirstMessage =
    firstMessage.length > MAX_FIRST_MESSAGE_LENGTH
      ? firstMessage.slice(0, MAX_FIRST_MESSAGE_LENGTH) + '...'
      : firstMessage

  const entry: ConversationEntry = {
    id: newConversationId,
    firstMessage: trimmedFirstMessage,
    timestamp: Date.now(),
  }
  if (forkOf) {
    entry.forkOf = forkOf
  }

  saveConversation(entry).catch((err: unknown) => {
    console.error('Failed to save conversation:', err)
  })
}
