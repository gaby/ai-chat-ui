import { PlusIcon, SearchIcon } from 'lucide-react'
import type React from 'react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConversationList } from '@/components/conversation-list'
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
} from '@/components/ui/sidebar'
import { useConversationIdFromUrl } from '@/hooks/useConversationIdFromUrl'
import { useConversations } from '@/hooks/useConversations'
import { stripBasePath, withBasePath } from '@/lib/base-path'
import { deleteConversation as deleteConv } from '@/lib/chat-db'
import type { ConversationEntry } from '@/types'
import { ModeToggle } from './mode-toggle'
import logoSvg from '../assets/logo.svg'

// Below this many conversations the list is short enough to scan, and a search
// box would just be chrome.
const SEARCH_THRESHOLD = 6

function doLocalNavigation(e: React.MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey) {
    return
  }
  const path = new URL((e.currentTarget as HTMLAnchorElement).href).pathname
  window.history.pushState({}, '', path)
  // custom event to notify other components of the URL change
  window.dispatchEvent(new Event('history-state-changed'))
  e.preventDefault()
}

function deleteConversation(conversationId: string) {
  return deleteConv(conversationId).then(() => {
    window.dispatchEvent(new Event('conversations-changed'))

    const currentPath = stripBasePath(window.location.pathname)
    if (currentPath === conversationId) {
      window.history.pushState({}, '', withBasePath('/'))
      window.dispatchEvent(new Event('history-state-changed'))
    }
  })
}

export function AppSidebar() {
  const conversations = useConversations()
  const [conversationId] = useConversationIdFromUrl()
  const [query, setQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<ConversationEntry | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((entry) => (entry.firstMessage ?? '').toLowerCase().includes(needle))
  }, [conversations, query])

  const handleDeleteClick = (e: React.MouseEvent, conversation: ConversationEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setConversationToDelete(conversation)
    setDeleteDialogOpen(true)
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
              <a href={withBasePath('/')} onClick={doLocalNavigation}>
                <PlusIcon className="text-primary" />
                <span>New conversation</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {conversations.length >= SEARCH_THRESHOLD && (
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
            onNavigate={doLocalNavigation}
            onDelete={handleDeleteClick}
          />
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 group-data-[state=collapsed]:justify-center">
          <span className="text-muted-foreground text-xs group-data-[state=collapsed]:hidden">
            Chats are stored in this browser
          </span>
          <ModeToggle className="size-8 shrink-0" />
        </div>
      </SidebarFooter>

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
              Are you sure you want to delete this chat? This action cannot be undone.
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
