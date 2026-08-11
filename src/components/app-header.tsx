import { KeyboardIcon, SquarePenIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { IS_MAC, KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConversationIdFromUrl } from '@/hooks/useConversationIdFromUrl'
import { useConversations } from '@/hooks/useConversations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { withBasePath } from '@/lib/base-path'
import { conversationTitle } from '@/lib/conversation-title'

const NEW_CHAT_SHORTCUT = IS_MAC ? '⇧⌘O' : 'Ctrl+Shift+O'
const SIDEBAR_SHORTCUT = IS_MAC ? '⌘B' : 'Ctrl+B'
const SHORTCUTS_SHORTCUT = IS_MAC ? '⌘/' : 'Ctrl+/'

function startNewConversation() {
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
  const conversations = useConversations()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const current = conversations.find((entry) => entry.id === conversationId)
  const isNew = conversationId === '/'
  const title = isNew ? 'New chat' : conversationTitle(current)

  useDocumentTitle(isNew ? null : title)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        startNewConversation()
      } else if (event.key === '/') {
        event.preventDefault()
        setShortcutsOpen((open) => !open)
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
        <TooltipContent>Toggle sidebar &middot; {SIDEBAR_SHORTCUT}</TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-medium" title={title}>
          {title}
        </h2>
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
        <TooltipContent>Keyboard shortcuts &middot; {SHORTCUTS_SHORTCUT}</TooltipContent>
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
        <TooltipContent>New chat &middot; {NEW_CHAT_SHORTCUT}</TooltipContent>
      </Tooltip>

      <ModeToggle className="text-muted-foreground hover:text-foreground" />

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  )
}
