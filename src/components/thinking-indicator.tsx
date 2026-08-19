const DOT_DELAYS = ['0ms', '150ms', '300ms']

/**
 * Shown between "message sent" and the first streamed token. A bare spinner
 * gave no reading of what was happening; this names the state and is announced
 * to screen readers.
 */
export function ThinkingIndicator() {
  return (
    <div aria-live="polite" className="text-muted-foreground flex items-center gap-2 py-1 text-sm" role="status">
      <span className="flex items-center gap-1" aria-hidden>
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            className="animate-thinking-dot size-1.5 rounded-full bg-current"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
      <span>Thinking</span>
    </div>
  )
}
