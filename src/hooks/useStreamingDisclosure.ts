import { useEffect, useRef, useState } from 'react'

// Long enough to register that the work finished, short enough not to sit in
// front of the answer.
const AUTO_COLLAPSE_DELAY = 1000

interface StreamingDisclosureOptions {
  /** Whether the content is arriving right now. */
  isStreaming: boolean
  /**
   * Something is there for a person to read or act on — a pending approval, a
   * call that failed or was denied, a run that stopped partway. Holds the fold
   * open and cancels the auto-collapse.
   */
  held?: boolean
}

interface StreamingDisclosure {
  open: boolean
  /** Call from the disclosure's own control: also records that a person chose. */
  onOpenChange: (next: boolean) => void
  /** Seconds spent streaming, rounded, or 0 if nothing streamed here. */
  duration: number
}

/**
 * A fold that opens itself while content is streaming and closes once it lands.
 *
 * Both foldable blocks in a turn — the reasoning trace and the activity block
 * around it — want exactly this, and they had a copy each. The copies drifted:
 * only one of them accumulated across streamed intervals, so a reasoning trace
 * interrupted by a tool approval reported the last leg alone.
 *
 * The clock runs only between a rise and the next fall, so a wait for the user
 * is not counted as work.
 */
export function useStreamingDisclosure({
  isStreaming,
  held = false,
}: StreamingDisclosureOptions): StreamingDisclosure {
  const [open, setOpen] = useState(isStreaming)
  const [duration, setDuration] = useState(0)
  const startedAt = useRef<number | null>(null)
  // Summed across intervals, because a turn can stop and start again: an
  // approval pauses it, and the continuation is a second stream. Replacing the
  // total each time reported only the last leg — 20s of work before an approval
  // and 2s after read as "2s".
  const elapsed = useRef(0)
  const userToggled = useRef(false)

  // Timing and auto-collapse key off the same transition, so they share one
  // effect — split, the first cleared `startedAt` before the second read it.
  useEffect(() => {
    if (isStreaming) {
      startedAt.current ??= Date.now()
      setOpen(true)
      return
    }

    // Nothing streamed here: a conversation restored from storage opens folded
    // and stays wherever the reader puts it.
    if (startedAt.current === null) return

    elapsed.current += Date.now() - startedAt.current
    startedAt.current = null
    setDuration(Math.max(1, Math.round(elapsed.current / 1000)))

    // Never pull it shut under someone who opened it, and never fold away
    // something that needs an answer — the timer is scheduled as the stream
    // ends, which is after both of those are already known.
    if (userToggled.current || held) return
    const timer = setTimeout(() => {
      // Checked again, not just before scheduling: a second is long enough for
      // someone to open it in the meantime, and this would shut it under them.
      if (userToggled.current) return
      setOpen(false)
    }, AUTO_COLLAPSE_DELAY)
    return () => {
      clearTimeout(timer)
    }
    // Keyed on `isStreaming` alone: `held` is read at the moment the stream
    // ends, and must not re-run the timing logic when it changes.
  }, [isStreaming])

  useEffect(() => {
    if (held) setOpen(true)
  }, [held])

  return {
    open,
    onOpenChange: (next: boolean) => {
      userToggled.current = true
      setOpen(next)
    },
    duration,
  }
}
