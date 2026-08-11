import { MoreHorizontalIcon, PencilIcon, PinIcon, PinOffIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ConversationEntry } from '@/types'

interface ConversationMenuProps {
  conversation: ConversationEntry
  title: string
  onRename: (conversation: ConversationEntry) => void
  onTogglePin: (conversation: ConversationEntry) => void
  onDelete: (conversation: ConversationEntry) => void
}

/**
 * Per-row actions for a conversation. They live behind one hover-revealed
 * button so the list stays a list of titles, and every action is reachable by
 * keyboard through a menu rather than a row of icons.
 */
export function ConversationMenu({ conversation, title, onRename, onTogglePin, onDelete }: ConversationMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Conversation options: ${title}`}
          className="text-muted-foreground hover:text-foreground data-[state=open]:bg-accent absolute top-1.5 right-1 size-7 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 group-data-[state=collapsed]:hidden"
          onClick={(event) => {
            // The row is a link; keep the menu from navigating.
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <MoreHorizontalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem
          onSelect={() => {
            onRename(conversation)
          }}
        >
          <PencilIcon className="size-3.5" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onTogglePin(conversation)
          }}
        >
          {conversation.pinned ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
          {conversation.pinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onDelete(conversation)
          }}
        >
          <Trash2Icon className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
