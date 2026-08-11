import { GitBranchIcon, MessageSquareIcon, PinIcon } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'

import { ConversationMenu } from '@/components/conversation-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { withBasePath } from '@/lib/base-path'
import { conversationTitle } from '@/lib/conversation-title'
import { absoluteTime, groupByDate, relativeTime, type DateGroup } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import type { ConversationEntry } from '@/types'

interface ConversationListProps {
  conversations: ConversationEntry[]
  activeId: string
  onNavigate: (event: React.MouseEvent) => void
  onRename: (conversation: ConversationEntry) => void
  onTogglePin: (conversation: ConversationEntry) => void
  onDelete: (conversation: ConversationEntry) => void
}

/**
 * The conversation history: pinned threads first, then bucketed by recency.
 * A flat list of absolute timestamps made anything past the first few rows hard
 * to find; headings plus relative times ("2h ago") turn scanning into skimming.
 */
export function ConversationList({
  conversations,
  activeId,
  onNavigate,
  onRename,
  onTogglePin,
  onDelete,
}: ConversationListProps) {
  useMinuteTick()

  const pinned = conversations.filter((entry) => entry.pinned)
  const rest = conversations.filter((entry) => !entry.pinned)
  const groups: DateGroup<ConversationEntry>[] = [
    ...(pinned.length > 0 ? [{ label: 'Pinned', items: pinned }] : []),
    ...groupByDate(rest, (entry) => entry.timestamp),
  ]

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupLabel className="text-muted-foreground/80 text-xs font-medium">{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((conversation) => {
              const isActive = conversation.id === activeId
              const title = conversationTitle(conversation)
              return (
                <SidebarMenuItem key={conversation.id} className="group/row relative">
                  <SidebarMenuButton asChild isActive={isActive} tooltip={title} className="h-auto py-2 pr-8">
                    <a
                      href={withBasePath(conversation.id)}
                      onClick={onNavigate}
                      className={cn('flex items-start gap-2', isActive && 'pointer-events-none')}
                    >
                      <ConversationIcon conversation={conversation} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{title}</span>
                        <span className="text-muted-foreground text-xs" title={absoluteTime(conversation.timestamp)}>
                          {relativeTime(conversation.timestamp)}
                        </span>
                      </span>
                    </a>
                  </SidebarMenuButton>
                  <ConversationMenu
                    conversation={conversation}
                    title={title}
                    onRename={onRename}
                    onTogglePin={onTogglePin}
                    onDelete={onDelete}
                  />
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}

/**
 * Re-render once a minute so the times stay true.
 *
 * These labels are read off the clock at render, and nothing else re-renders
 * this list while the app sits open — so a row read "Just now" hours later, and
 * kept yesterday's heading past midnight.
 */
function useMinuteTick(): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1)
    }, 60_000)
    return () => {
      clearInterval(id)
    }
  }, [])
}

function ConversationIcon({ conversation }: { conversation: ConversationEntry }) {
  const className = 'mt-0.5 size-3.5 shrink-0 opacity-70'
  if (conversation.pinned) return <PinIcon className={className} />
  if (conversation.forkOf) return <GitBranchIcon className={className} />
  return <MessageSquareIcon className={className} />
}
