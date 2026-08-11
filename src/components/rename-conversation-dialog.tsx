import { useEffect, useState, type SyntheticEvent } from 'react'

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

interface RenameConversationDialogProps {
  open: boolean
  initialTitle: string
  onOpenChange: (open: boolean) => void
  onSubmit: (title: string) => void
}

/**
 * Rename a conversation. Titles otherwise default to the opening message,
 * which stops describing the thread the moment it goes anywhere.
 */
export function RenameConversationDialog({
  open,
  initialTitle,
  onOpenChange,
  onSubmit,
}: RenameConversationDialogProps) {
  const [draft, setDraft] = useState(initialTitle)

  // Reset whenever the dialog is opened for a (possibly different) conversation.
  useEffect(() => {
    if (open) setDraft(initialTitle)
  }, [open, initialTitle])

  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const trimmed = draft.trim()
    if (trimmed === '') return
    onSubmit(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>Give this chat a name you will recognise later.</DialogDescription>
          </DialogHeader>

          <Input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
            aria-label="Conversation name"
            placeholder="Conversation name"
            className="my-4"
            autoFocus
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={draft.trim() === ''}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
