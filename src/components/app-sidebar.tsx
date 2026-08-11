import { PlusIcon, SearchIcon } from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConversationList } from '@/components/conversation-list'
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
import { useConversations } from '@/hooks/useConversations'
import { stripBasePath, withBasePath } from '@/lib/base-path'
import { deleteConversation as deleteConv, saveConversation } from '@/lib/chat-db'
import { conversationTitle } from '@/lib/conversation-title'
import type { ConversationEntry } from '@/types'
import logoSvg from '../assets/logo.svg'

// Below this many conversations the list is short enough to scan, and a search
// box would just be chrome.
const SEARCH_THRESHOLD = 6

function doLocalNavigation(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey) {
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
      window.history.pushState({}, '', withBasePath('/'))
      window.dispatchEvent(new Event('history-state-changed'))
    }
  })
}

function updateConversation(conversation: ConversationEntry, patch: Partial<ConversationEntry>) {
  return saveConversation({ ...conversation, ...patch })
}

export function AppSidebar() {
  const { setOpenMobile } = useSidebar()
  const conversations = useConversations()
  const [conversationId] = useConversationIdFromUrl()
  const [query, setQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<ConversationEntry | null>(null)
  const [conversationToRename, setConversationToRename] = useState<ConversationEntry | null>(null)

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
    updateConversation(conversation, { pinned: !conversation.pinned }).catch((err: unknown) => {
      console.error('Failed to pin conversation:', err)
    })
  }

  const handleRenameSubmit = (title: string) => {
    if (!conversationToRename) return
    // Re-read the entry rather than writing back the copy captured when the
    // menu opened: the dialog can stay open across a `conversations-changed`
    // (an active run bumps the timestamp), and the stale copy would put the
    // conversation back where it was in the list.
    const id = conversationToRename.id
    const conversation = conversations.find((entry) => entry.id === id) ?? conversationToRename
    setConversationToRename(null)
    updateConversation(conversation, { title }).catch((err: unknown) => {
      console.error('Failed to rename conversation:', err)
      toast.error('Failed to rename chat')
    })
  }

  const handleConfirmDelete = () => {
    if (conversationToDelete) {
      deleteConversation(conversationToDelete.id)
        .then(() => {
          setDeleteDialogOpen(false)
          setConversationToDelete(null)
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
            <p className="text-muted-foreground px-2 py-6 text-center text-xs group-data-[state=collapsed]:hidden">
              {conversations.length === 0 ? 'No conversations yet.' : 'No conversations match your search.'}
            </p>
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
        <DialogContent
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirmDelete()
            }
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
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} autoFocus>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  )
}
