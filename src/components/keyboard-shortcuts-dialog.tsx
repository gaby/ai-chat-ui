import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const IS_MAC = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')

const MOD = IS_MAC ? '⌘' : 'Ctrl'

export const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: [MOD, 'Shift', 'O'], description: 'New chat' },
  { keys: [MOD, 'B'], description: 'Toggle sidebar' },
  { keys: [MOD, '/'], description: 'Show this list' },
  { keys: ['Enter'], description: 'Send message' },
  { keys: ['Shift', 'Enter'], description: 'New line in the composer' },
  { keys: ['Esc'], description: 'Cancel an edit' },
]

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The shortcuts exist either way; this makes them discoverable instead of
 * folklore. Reached with Cmd/Ctrl+/ or from the header.
 */
export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move around without reaching for the mouse.</DialogDescription>
        </DialogHeader>

        <dl className="divide-border divide-y">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.description} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-sm">{shortcut.description}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-sans text-xs"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
