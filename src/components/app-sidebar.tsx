import { PlusIcon, SearchIcon } from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConversationList } from '@/components/conversation-list'
import { ConversationListError } from '@/components/conversation-list-error'
import { RenameConversationDialog } from '@/components/rename-conversation-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useConversationIdFromUrl } from '@/hooks/useConversationIdFromUrl'
import { retryConversations, useConversationsState } from '@/hooks/useConversations'
import { stripBasePath, withBasePath } from '@/lib/base-path'
import { deleteConversation as deleteConv, patchConversation } from '@/lib/chat-db'
import { conversationTitle } from '@/lib/conversation-title'
import type { ConversationEntry } from '@/types'
import logoSvg from '../assets/logo.svg'

// Below this many conversations the list is short enough to scan, and a search
// box would just be chrome.
const SEARCH_THRESHOLD = 6

function doLocalNavigation(e: React.MouseEvent) {
  // Every modified click the browser gives its own meaning: middle and
  // ctrl/cmd open a tab, shift opens a window. Intercepting those would turn a
  // deliberate "somewhere else" into a plain navigation in this tab.
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) {
    return
  }
  const path = new URL((e.currentTarget as HTMLAnchorElement).href).pathname
  e.preventDefault()
  // Going where we already are: pushing would stack a duplicate entry that Back
  // has to walk through before it appears to do anything.
  if (path === window.location.pathname) return
  window.history.pushState({}, '', path)
  // custom event to notify other components of the URL change
  window.dispatchEvent(new Event('history-state-changed'))
}

function deleteConversation(conversationId: string) {
  // `chat-db` emits `conversations-changed` itself.
  return deleteConv(conversationId).then(() => {
    const currentPath = stripBasePath(window.location.pathname)
    if (currentPath === conversationId) {
      // Replace rather than push: pushing leaves the deleted conversation one
      // Back press away, and it would open as an empty chat that silently
      // discards everything typed into it.
      window.history.replaceState({}, '', withBasePath('/'))
      window.dispatchEvent(new Event('history-state-changed'))
    }
  })
}

export function AppSidebar() {
  const { setOpenMobile } = useSidebar()
  const { conversations, failed } = useConversationsState()
  const [conversationId] = useConversationIdFromUrl()
  const [query, setQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<ConversationEntry | null>(null)
  const [conversationToRename, setConversationToRename] = useState<ConversationEntry | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // The box unmounts once the list is short enough to scan; a filter left
  // behind would keep hiding rows with no input to clear it.
  const showSearch = conversations.length >= SEARCH_THRESHOLD
  useEffect(() => {
    if (!showSearch) setQuery('')
  }, [showSearch])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((entry) => conversationTitle(entry).toLowerCase().includes(needle))
  }, [conversations, query])

  // On a phone the sidebar is a sheet over the conversation. Left open after a
  // selection it covers the chat that was just picked, and `Sidebar` hides the
  // sheet's own close button, so the way out is an undiscoverable tap on the
  // overlay. `doLocalNavigation` only calls `preventDefault` for navigations it
  // handled itself — a modified click still opens a new tab and leaves the
  // sheet alone.
  const handleNavigate = (e: React.MouseEvent) => {
    doLocalNavigation(e)
    if (e.defaultPrevented) setOpenMobile(false)
  }

  const handleDeleteClick = (conversation: ConversationEntry) => {
    setConversationToDelete(conversation)
    setDeleteDialogOpen(true)
  }

  const handleTogglePin = (conversation: ConversationEntry) => {
    patchConversation(conversation.id, { pinned: !conversation.pinned }).catch((err: unknown) => {
      console.error('Failed to pin conversation:', err)
    })
  }

  const handleRenameSubmit = (title: string) => {
    if (!conversationToRename) return
    // Only the title travels. Writing the whole entry back would carry the
    // snapshot taken when the menu opened, and the dialog can sit open across
    // an activity stamp — which would then be undone.
    const id = conversationToRename.id
    setConversationToRename(null)
    patchConversation(id, { title }).catch((err: unknown) => {
      console.error('Failed to rename conversation:', err)
      toast.error('Failed to rename chat')
    })
  }

  // The entry outlives the dialog on purpose. Clearing it as the dialog closes
  // blanked the name mid-animation, so the last thing seen of a delete was the
  // confirmation asking about "Untitled chat". It is only ever read while a
  // dialog is open, and `handleDeleteClick` replaces it before the next one.
  const handleConfirmDelete = () => {
    if (conversationToDelete) {
      deleteConversation(conversationToDelete.id)
        .then(() => {
          setDeleteDialogOpen(false)
          toast.success('Chat deleted successfully')
        })
        .catch((err: unknown) => {
          console.error('Failed to delete conversation:', err)
          toast.error('Failed to delete chat')
        })
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        <div className="flex h-8 items-center gap-2 px-1">
          <img src={logoSvg} alt="" className="size-5 shrink-0" />
          <span className="truncate text-sm font-semibold group-data-[state=collapsed]:hidden">Pydantic AI</span>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="New conversation"
              className="bg-primary/10 text-foreground hover:bg-primary/15 font-medium"
            >
              <a href={withBasePath('/')} onClick={handleNavigate}>
                <PlusIcon className="text-primary" />
                <span>New conversation</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {showSearch && (
          <div className="relative group-data-[state=collapsed]:hidden">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="custom-scrollbar">
        {filtered.length === 0 ? (
          <SidebarGroup>
            {failed ? (
              <ConversationListError onRetry={retryConversations} />
            ) : (
              <p className="text-muted-foreground px-2 py-6 text-center text-xs group-data-[state=collapsed]:hidden">
                {conversations.length === 0 ? 'No conversations yet.' : 'No conversations match your search.'}
              </p>
            )}
          </SidebarGroup>
        ) : (
          <ConversationList
            conversations={filtered}
            activeId={conversationId}
            onNavigate={handleNavigate}
            onRename={setConversationToRename}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteClick}
          />
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* The theme toggle lives in the header; a second one here gave the app
            two controls with the same accessible name. */}
        <p className="text-muted-foreground px-2 text-xs group-data-[state=collapsed]:hidden">
          Chats are stored in this browser
        </p>
      </SidebarFooter>

      {conversationToRename && (
        <RenameConversationDialog
          key={conversationToRename.id}
          open
          initialTitle={conversationTitle(conversationToRename)}
          onOpenChange={(open) => {
            if (!open) setConversationToRename(null)
          }}
          onSubmit={handleRenameSubmit}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        {/* Focus opens on Cancel, and Enter is left to whichever button holds
            it. A dialog-wide Enter handler used to confirm the delete no matter
            where focus was, so activating the safe control destroyed the
            conversation. Cancel is picked explicitly rather than left to the
            first-tabbable default, so reordering the footer cannot quietly put
            an irreversible action under the opening keystroke. */}
        <DialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              &ldquo;{conversationTitle(conversationToDelete ?? undefined)}&rdquo; and its messages will be removed
              from this browser. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelRef}
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
