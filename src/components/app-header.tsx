import { KeyboardIcon, SquarePenIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { KeyboardShortcutsDialog, shortcutLabel } from '@/components/keyboard-shortcuts-dialog'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConversationIdFromUrl } from '@/hooks/useConversationIdFromUrl'
import { useConversationsState } from '@/hooks/useConversations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { stripBasePath, withBasePath } from '@/lib/base-path'
import { conversationTitle } from '@/lib/conversation-title'

function startNewConversation() {
  // Already on a new chat: pushing again stacks identical `/` entries, and Back
  // then has to walk through every one of them before it appears to do
  // anything.
  if (stripBasePath(window.location.pathname) === '/') return
  window.history.pushState({}, '', withBasePath('/'))
  window.dispatchEvent(new Event('history-state-changed'))
}

/**
 * Slim application bar above the conversation. It gives the chat a fixed
 * anchor: where you are (the conversation title), how to get out of a
 * collapsed sidebar, and the actions people reach for most.
 */
export function AppHeader() {
  const [conversationId] = useConversationIdFromUrl()
  const { conversations, loaded } = useConversationsState()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const current = conversations.find((entry) => entry.id === conversationId)
  const isNew = conversationId === '/'
  // Until the store has been read there is no entry to find, which is not the
  // same as the conversation having no name — resolving it early flashed
  // "Untitled chat" in the header and the tab on every reload.
  const title = isNew ? 'New chat' : loaded ? conversationTitle(current) : ''

  useDocumentTitle(isNew || !loaded ? null : title)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      // A modal owns the keyboard while it is up. Navigating out from under an
      // open dialog left it mounted over a conversation it no longer belonged
      // to, still holding a half-typed rename.
      const modalOpen = document.querySelector('[role="dialog"][data-state="open"]') !== null
      if (event.shiftKey && event.key.toLowerCase() === 'o') {
        if (modalOpen) return
        event.preventDefault()
        startNewConversation()
      } else if (event.key === '/') {
        event.preventDefault()
        // Still closes its own dialog; it just cannot open on top of another.
        setShortcutsOpen((open) => (open ? false : !modalOpen))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1" />
        </TooltipTrigger>
        <TooltipContent>Toggle sidebar &middot; {shortcutLabel('toggle-sidebar')}</TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1">
        {/* The app's h1: without it the document outline started at h2 on any
            open conversation. */}
        <h1 className="truncate text-sm font-medium" title={title}>
          {title}
        </h1>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Keyboard shortcuts"
            onClick={() => {
              setShortcutsOpen(true)
            }}
            className="text-muted-foreground hover:text-foreground hidden sm:inline-flex"
          >
            <KeyboardIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Keyboard shortcuts &middot; {shortcutLabel('shortcuts')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New chat"
            onClick={startNewConversation}
            className="text-muted-foreground hover:text-foreground"
          >
            <SquarePenIcon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New chat &middot; {shortcutLabel('new-chat')}</TooltipContent>
      </Tooltip>

      <ModeToggle className="text-muted-foreground hover:text-foreground" />

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  )
}
