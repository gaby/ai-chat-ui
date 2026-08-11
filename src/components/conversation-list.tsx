import { GitBranchIcon, MessageSquareIcon, Trash2Icon } from 'lucide-react'
import type React from 'react'

import { Button } from '@/components/ui/button'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { withBasePath } from '@/lib/base-path'
import { absoluteTime, groupByDate, relativeTime } from '@/lib/format-time'
import { cn } from '@/lib/utils'
import type { ConversationEntry } from '@/types'

interface ConversationListProps {
  conversations: ConversationEntry[]
  activeId: string
  onNavigate: (event: React.MouseEvent) => void
  onDelete: (event: React.MouseEvent, conversation: ConversationEntry) => void
}

/**
 * The conversation history, bucketed by recency. A flat list of absolute
 * timestamps made it hard to find anything past the first few rows; date
 * headings plus relative times ("2h ago") turn scanning into skimming.
 */
export function ConversationList({ conversations, activeId, onNavigate, onDelete }: ConversationListProps) {
  const groups = groupByDate(conversations, (entry) => entry.timestamp)

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupLabel className="text-muted-foreground/80 text-xs font-medium">{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((conversation) => {
              const isActive = conversation.id === activeId
              return (
                <SidebarMenuItem key={conversation.id} className="group/row relative">
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={conversation.firstMessage}
                    className="h-auto py-2"
                  >
                    <a
                      href={withBasePath(conversation.id)}
                      onClick={onNavigate}
                      className={cn('flex items-start gap-2', isActive && 'pointer-events-none')}
                    >
                      {conversation.forkOf ? (
                        <GitBranchIcon className="mt-0.5 size-3.5 shrink-0 opacity-70" />
                      ) : (
                        <MessageSquareIcon className="mt-0.5 size-3.5 shrink-0 opacity-70" />
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{conversation.firstMessage}</span>
                        <span
                          className="text-muted-foreground text-xs"
                          title={absoluteTime(conversation.timestamp)}
                          suppressHydrationWarning
                        >
                          {relativeTime(conversation.timestamp)}
                        </span>
                      </span>
                    </a>
                  </SidebarMenuButton>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete conversation: ${conversation.firstMessage ?? 'untitled'}`}
                        className="text-muted-foreground hover:text-destructive absolute top-1.5 right-1 size-7 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 group-data-[state=collapsed]:hidden"
                        onClick={(e) => {
                          onDelete(e, conversation)
                        }}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete conversation</TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
