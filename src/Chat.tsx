import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources'
import { AssistantTurn } from '@/components/assistant-turn'
import { ChatComposer } from '@/components/chat-composer'
import { ChatError } from '@/components/chat-error'
import { ConfigErrorBanner } from '@/components/config-error-banner'
import { ConversationLoadError } from '@/components/conversation-load-error'
import { EditMessageDialog } from '@/components/edit-message-dialog'
import { HiddenToolsGroup } from '@/components/hidden-tools-group'
import { ThinkingIndicator } from '@/components/thinking-indicator'
import { ToolCallGroup } from '@/components/tool-call-group'
import { ToolFiltersDialog } from '@/components/tool-filters-dialog'
import { UsageSummary } from '@/components/usage-summary'
import { WelcomeScreen } from '@/components/welcome-screen'
import { TurnActivity, TurnActivityStep } from '@/components/turn-activity'
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
import type { ConversationEntry } from './types'
import { readEffort, writeEffort } from '@/lib/effort'
import { fetchConfig } from '@/lib/config'
import { resolveSelectedModel } from '@/lib/models'
import { toolNameOfPart } from '@/lib/tool-filters'
import { COMPLETE_TOOL_STATES, groupParts, type PartRun } from '@/lib/tool-grouping'
import {
  ensureConversationEntry,
  getMessages,
  isConversationDeleted,
  saveMessages,
  saveConversation,
} from '@/lib/chat-db'
import { stripBasePath, withBasePath } from '@/lib/base-path'

// TODO: if just a single model, don't show model selector, just a label.

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

  // The exact array handed to `setMessages` by a load. The save effect fires on
  // that echo too, so without this, opening a conversation rewrote its whole
  // history back to IndexedDB and stamped it as activity — a thread read but
  // not replied to jumped out of "Older" to the top of the sidebar.
  const loadedMessagesRef = useRef<UIMessage[] | null>(null)

  // The conversation-change effect keys off `conversationId` alone, but has to
  // flush what is still on screen before clearing it.
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const loadedIdRef = useRef(loadedConversationId)
  loadedIdRef.current = loadedConversationId

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const editDraftsRef = useRef(new Map<string, string>())
  const [pendingEdit, setPendingEdit] = useState<{ messageId: string; text: string } | null>(null)
  // Deferred send: set this ref, then call setMessages. The useEffect below
  // will fire sendMessage after the messages state has been committed.
  const pendingSendRef = useRef<{
    text: string
    model: string
    builtinTools: string[]
    /** The conversation this was queued for; '/' means "wherever we are". */
    conversationId: string
  } | null>(null)
  const [sendTrigger, setSendTrigger] = useState(0)
  // Bumped by the retry button to re-run the load effect.
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)

  const configQuery = useQuery({
    queryFn: fetchConfig,
    queryKey: ['models'],
  })

  useEffect(() => {
    // A backend with no providers configured returns an empty list; the composer
    // degrades to a disabled model select rather than the chat crashing here.
    const models = configQuery.data?.models
    // Nothing has come back yet. Leaving the selection alone matters on a failed
    // refetch, where the last good configuration is still what the backend has.
    if (!models) return
    setModel((current) => resolveSelectedModel(models, current))
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
    // A read that is still in flight when the next navigation starts must not
    // install its result: IndexedDB reads can finish out of order, so a large
    // history left behind could land on top of the small one now on screen —
    // the previous conversation's messages under this one's title, and anything
    // typed next saved against the stale id.
    let superseded = false

    setEditingMessageId(null)
    setLoadFailed(false)

    // A deferred send belongs to one conversation. Leaving before its history
    // arrives abandons it: left in place it suppresses the welcome screen on
    // whatever empty chat comes next, and would fire the old prompt if its
    // target were ever reopened.
    if (pendingSendRef.current && pendingSendRef.current.conversationId !== conversationId) {
      pendingSendRef.current = null
    }

    // The conversation this session just created: the messages already in
    // memory are its own, and a run is streaming into it. Neither clear nor
    // stop applies.
    if (createdHereRef.current === conversationId) {
      createdHereRef.current = null
      setLoadedConversationId(conversationId)
      return
    }

    // Deleted in this session, reached by Back or a stale link. Left alone it
    // opens as an empty chat under the old id, and every message typed into it
    // is dropped by the write guard without a word.
    if (conversationId !== '/' && isConversationDeleted(conversationId)) {
      window.history.replaceState({}, '', withBasePath('/'))
      window.dispatchEvent(new Event('history-state-changed'))
      return
    }

    // Abandon any run still streaming into the conversation we are leaving.
    // Without this the SDK keeps appending its chunks, and they land in
    // whichever conversation is now on screen.
    void stopRef.current()

    // Flush before clearing. `useThrottle` cancels its pending write whenever
    // the value changes, and the clear below changes it — so leaving within
    // 500ms of the last chunk dropped that tail, taking the reply's usage
    // metadata with it.
    const leavingId = loadedIdRef.current
    const leavingMessages = messagesRef.current
    // Same rule the save effect follows: an untouched visit is not a write, and
    // flushing one here would put the conversation back at the top of the
    // sidebar for having been read.
    if (
      leavingMessages !== loadedMessagesRef.current &&
      leavingId !== null &&
      leavingId !== '/' &&
      leavingMessages.length > 0
    ) {
      saveMessages(leavingId, leavingMessages).catch((err: unknown) => {
        console.error('Failed to save messages:', err)
      })
    }

    // Clear first either way: leaving the old messages mounted while the read is
    // in flight shows the previous conversation under this one's title, and the
    // save effect would then persist them under this id.
    setMessages([])
    setLoadedConversationId(conversationId === '/' ? '/' : null)

    if (conversationId !== '/') {
      getMessages(conversationId)
        .then((storedMessages) => {
          if (superseded) return
          const loaded = storedMessages ?? []
          loadedMessagesRef.current = loaded
          setMessages(loaded)
          setLoadedConversationId(conversationId)

          // Auto-send the forked message once its own conversation is loaded.
          // Navigating elsewhere before the read lands must not deliver it into
          // whichever conversation happens to finish loading next.
          if (pendingSendRef.current?.conversationId === conversationId) {
            setSendTrigger((n) => n + 1)
          }
        })
        .catch((err: unknown) => {
          if (superseded) return
          console.error('Failed to load messages:', err)
          // Deliberately left unloaded. Marking it loaded would arm the save
          // effect against an empty `messages`, so the next reply would be
          // written over the history that merely failed to *read* — a transient
          // storage error turned into permanent data loss. Unloaded, the
          // composer refuses to send and the banner offers a retry instead.
          setLoadFailed(true)
        })
    }
    textareaRef.current?.focus()

    return () => {
      superseded = true
    }
  }, [conversationId, loadAttempt])

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    // The send button is swapped for a stop control mid-run, but Enter in the
    // textarea still calls `requestSubmit()`. Without this guard a follow-up
    // typed while a tool call is in flight would drop the streaming assistant
    // turn below and fire a second, concurrent request.
    if (status === 'submitted' || status === 'streaming') return
    // The history is still being read: `messages` is empty, so the request
    // would go out without it and the read would then land on top of whatever
    // came back.
    if (loadedConversationId !== conversationId) return
    // The send button is disabled without a model, but Enter bypasses it. Sending
    // `model: ''` either fails the request or lets the backend pick something the
    // user did not choose.
    if (!model) {
      toast.error('No model available yet. Check that the backend is configured.')
      return
    }

    // we're starting a new conversation
    if (stripBasePath(window.location.pathname) === '/') {
      const newConversationId = `/${nanoid()}`
      createdHereRef.current = newConversationId
      // `setConversationId` pushes the URL itself; pushing again here left two
      // identical history entries, so Back appeared to do nothing.
      setConversationId(newConversationId)
      saveConversationEntry(newConversationId, input)
    } else if (messages.length === 0) {
      // An id with no history behind it: a bookmark to a conversation cleared
      // from this browser, or a mistyped URL. It opened as an empty chat and
      // accepted messages, but nothing created an entry for it — so the reply
      // was stored under an id the sidebar had never heard of and disappeared
      // as soon as it was navigated away from. Insert-only, so a conversation
      // that does exist keeps its title, pin and place in the list.
      ensureConversationEntry(conversationEntry(conversationId, input)).catch((err: unknown) => {
        console.error('Failed to create conversation:', err)
      })
    }

    // A run stopped mid tool-call leaves a tool part with no output, and
    // pydantic-ai rejects an orphaned tool call — same cleanup `handleContinue`
    // does, which the plain send path was missing.
    const lastMessage = messages.at(-1)
    if (lastMessage?.role === 'assistant' && hasIncompleteToolPart(lastMessage.parts)) {
      // An unanswered tool call cannot be left in the history, so the whole
      // trailing turn goes — including any prose above it. That is a lot to
      // remove without a word, and it is easy to trigger by typing instead of
      // answering an approval prompt.
      toast.info('Removed the unfinished tool call so your message could be sent.')
      pendingSendRef.current = { text: input, model, builtinTools: enabledTools, conversationId }
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
    // Reading is not writing: the snapshot a load produced is byte-for-byte what
    // is already stored.
    if (pending === loadedMessagesRef.current) return
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

    pendingSendRef.current = { text: pendingEdit.text, model, builtinTools: enabledTools, conversationId }
    setMessages(messages.slice(0, messageIndex))
    setPendingEdit(null)
    // Defer to next macrotask so setMessages commits before the send effect fires
    setTimeout(() => {
      setSendTrigger((n) => n + 1)
    }, 0)
  }, [pendingEdit, messages, setMessages, model, enabledTools, conversationId])

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
    pendingSendRef.current = { text, model, builtinTools: enabledTools, conversationId }
    // Drop the user message too; the deferred send re-adds it cleanly.
    setMessages(messages.slice(0, i))
    setTimeout(() => {
      setSendTrigger((n) => n + 1)
    }, 0)
  }, [messages, clearError, setMessages, model, enabledTools, conversationId])

  // Continue: append a `continue` user message to a valid history. If the run
  // errored mid-tool-call, the trailing assistant message may hold a tool part
  // with no output; pydantic-ai rejects an orphaned tool call, so drop that
  // trailing assistant message first.
  const handleContinue = useCallback(() => {
    const lastMessage = messages.at(-1)
    if (lastMessage?.role === 'assistant' && hasIncompleteToolPart(lastMessage.parts)) {
      clearError()
      pendingSendRef.current = { text: 'continue', model, builtinTools: enabledTools, conversationId }
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
  }, [messages, clearError, setMessages, sendMessage, model, enabledTools, conversationId])

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
    pendingSendRef.current = {
      text: pendingEdit.text,
      model,
      builtinTools: enabledTools,
      conversationId: newConversationId,
    }

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
    // just be typed into. The clamp to the old draft's length that this looks
    // like it would hit does not happen: committing the new value resets the
    // selection to the end of it, which `welcome.spec.ts` pins down.
    textarea?.setSelectionRange(prompt.length, prompt.length)
  }, [])

  const renderTurn = (message: UIMessage, messageIndex: number, isStreaming = false) =>
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
      isStreaming,
    )

  const loadErrorBanner = loadFailed && (
    <div className="mx-auto w-full max-w-3xl px-4">
      <ConversationLoadError
        onRetry={() => {
          setLoadAttempt((n) => n + 1)
        }}
      />
    </div>
  )

  const configBanner = configQuery.isError && (
    <div className="mx-auto w-full max-w-3xl px-4">
      <ConfigErrorBanner
        isRetrying={configQuery.isFetching}
        onRetry={() => {
          configQuery.refetch().catch((error: unknown) => {
            console.error('Error reloading configuration:', error)
          })
        }}
      />
    </div>
  )

  const renderComposer = (showHint: boolean) => (
    <ChatComposer
      canSend={loadedConversationId === conversationId}
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
  // conversation does not flash the welcome screen before its messages arrive,
  // and on no send being queued: retrying, or modifying the first message,
  // empties `messages` for a frame on its way to re-sending it, which otherwise
  // threw up the greeting and remounted the composer under the caret.
  if (
    messages.length === 0 &&
    status === 'ready' &&
    loadedConversationId === conversationId &&
    pendingSendRef.current === null
  ) {
    return (
      <>
        {/* `my-auto` rather than `items-center`: a centred flex child cannot be
            scrolled back to once it overflows, which clipped the heading on
            short viewports. */}
        <div className="flex flex-1 flex-col overflow-y-auto py-8">
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
            const isStreaming = (status === 'streaming' || status === 'submitted') && isLast
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
                {renderTurn(message, messageIndex, isStreaming)}
              </AssistantTurn>
            )
          })}

          {/* Only when there is no assistant turn to continue. Answering an
              approval sends the run back to `submitted` with the turn still on
              screen and already showing its own live activity, so this added a
              second avatar and a second "Thinking" underneath it — for as long
              as the backend took to send the next chunk. */}
          {status === 'submitted' && messages.at(-1)?.role !== 'assistant' && (
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
      {/* No horizontal padding here: the composer and the banner carry the same
          `px-4` inside their own `max-w-3xl` box that `ConversationContent` does,
          which is what puts all three on the same edges. */}
      <div className="bg-background sticky bottom-0 pt-1 pb-3">
        {loadErrorBanner}
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
  isStreaming: boolean,
): ReactNode[] {
  const descriptors = message.parts.map((part) => {
    const toolName = toolNameOfPart(part)
    return { toolName, filtered: toolName !== null && isFiltered(toolName) }
  })

  const renderRun = (run: PartRun): ReactNode => {
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
  }

  // Laid out before anything renders, because a block cannot tell whether it is
  // still live until it knows what follows it.
  const items: ({ kind: 'activity'; runs: PartRun[] } | { kind: 'part'; run: PartRun })[] = []
  // Consecutive work — thinking and tool calls — collects into one foldable
  // block, so a turn reads as "what the agent did" then "what it said" rather
  // than as a stack of cards the answer has to be scrolled past.
  let activity: PartRun[] = []

  const flushActivity = () => {
    if (activity.length === 0) return
    items.push({ kind: 'activity', runs: activity })
    activity = []
  }

  for (const run of groupParts(descriptors)) {
    // Parts the message column draws nothing for still ended the current run,
    // so a tool loop split into a foldable block per invisible marker — the
    // exact shape the single block exists to collect. `step-start` marks a model
    // step boundary and sources are collected into the strip above the turn, and
    // a provider that cites its sources emits them between the calls they came
    // from.
    if (run.kind === 'single' && !isRenderedPart(message.parts[run.index])) continue
    if (run.kind !== 'single' || isActivityPart(message.parts[run.index])) {
      activity.push(run)
      continue
    }
    flushActivity()
    items.push({ kind: 'part', run })
  }
  flushActivity()

  return items.map((item, position) => {
    if (item.kind === 'part') return renderRun(item.run)

    const { runs } = item
    const indices = runs.flatMap((run) => (run.kind === 'single' ? [run.index] : run.indices))
    const toolIndices = indices.filter((i) => toolNameOfPart(message.parts[i]) !== null)

    return (
      <TurnActivity
        key={`activity-${message.id}-${indices[0]}`}
        calls={toolIndices.map((i) => ({
          name: toolNameOfPart(message.parts[i]) ?? '',
          state: partState(message.parts[i]),
        }))}
        hasReasoning={indices.some((i) => message.parts[i].type === 'reasoning')}
        // Only the last block of a streaming reply is live. A turn that works,
        // answers, then works again renders two blocks, and handing both the
        // message's streaming flag left the first one spinning "Working" and
        // counting time it was no longer spending — anything rendered after a
        // block means the model has moved on from it.
        isStreaming={isStreaming && position === items.length - 1}
      >
        {runs.map((run) => (
          <TurnActivityStep key={`step-${message.id}-${run.kind === 'single' ? run.index : run.indices[0]}`}>
            {renderRun(run)}
          </TurnActivityStep>
        ))}
      </TurnActivity>
    )
  })
}

// Whether `Part` puts anything on screen for this part. Kept in step with the
// branches in `Part.tsx`: text, reasoning and tool calls render, and everything
// else a message can carry (`step-start`, sources, files) draws nothing here.
function isRenderedPart(part: UIMessagePart<UIDataTypes, UITools>): boolean {
  return part.type === 'text' || part.type === 'reasoning' || toolNameOfPart(part) !== null
}

// What belongs in the activity block: the model's thinking and its tool calls.
// Prose is the answer and stays out of it; sources render in their own strip
// above the turn.
function isActivityPart(part: UIMessagePart<UIDataTypes, UITools>): boolean {
  return part.type === 'reasoning' || toolNameOfPart(part) !== null
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

function conversationEntry(
  newConversationId: string,
  firstMessage: string,
  forkOf?: ConversationEntry['forkOf'],
): ConversationEntry {
  const trimmedFirstMessage =
    firstMessage.length > MAX_FIRST_MESSAGE_LENGTH
      ? firstMessage.slice(0, MAX_FIRST_MESSAGE_LENGTH) + '...'
      : firstMessage

  const now = Date.now()
  const entry: ConversationEntry = {
    id: newConversationId,
    firstMessage: trimmedFirstMessage,
    timestamp: now,
    createdAt: now,
  }
  if (forkOf) {
    entry.forkOf = forkOf
  }
  return entry
}

function saveConversationEntry(newConversationId: string, firstMessage: string, forkOf?: ConversationEntry['forkOf']) {
  saveConversation(conversationEntry(newConversationId, firstMessage, forkOf)).catch((err: unknown) => {
    console.error('Failed to save conversation:', err)
  })
}
