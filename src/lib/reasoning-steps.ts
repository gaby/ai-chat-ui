export interface ReasoningStep {
  /** Heading the model gave this step, when it gave one. */
  title?: string
  body: string
}

const HEADING_PATTERNS = [
  /^#{1,6}\s+(.+?)\s*$/, // markdown heading
  // A single bolded span filling the line. `[^*]` rather than `.+?` so a line
  // with two bold spans does not collapse into one "title" containing `**`.
  /^\*\*([^*]+)\*\*[:.]?\s*$/,
]

/**
 * Split on blank lines, except inside a fenced code block — a fence with a
 * blank line in it would otherwise be torn across two steps and rendered as two
 * broken fences.
 *
 * The opening marker is remembered, because a fence only closes on the same
 * character at the same width or wider, with nothing after it. Toggling on any
 * fence-looking line closed a ````-fenced block at the ``` example inside it,
 * and the blank lines that followed then tore the code apart.
 */
/**
 * Tracks whether the lines fed to it are inside a fenced code block.
 *
 * Shared by the two passes below so they cannot disagree about where the code
 * is — one splitting on blank lines, the other on headings.
 */
function fenceTracker() {
  let fence: { char: string; width: number } | null = null

  return {
    get open() {
      return fence !== null
    },
    /** Feed one line, in order. Returns whether a fence is open after it. */
    push(line: string): boolean {
      const match = /^\s*(`{3,}|~{3,})(.*)$/.exec(line)
      if (match) {
        const [, marker, rest] = match
        if (fence === null) {
          // An opening fence may carry an info string (```python).
          fence = { char: marker[0], width: marker.length }
        } else if (marker.startsWith(fence.char) && marker.length >= fence.width && rest.trim() === '') {
          // A closing one may not: ```` ```not-a-close ```` is content, and
          // treating it as the closer let the next blank line split the block.
          fence = null
        }
      }
      return fence !== null
    },
  }
}

function splitParagraphs(text: string): string[] {
  const paragraphs: string[] = []
  let current: string[] = []
  const fence = fenceTracker()

  const flush = () => {
    const paragraph = current.join('\n').trim()
    if (paragraph !== '') paragraphs.push(paragraph)
    current = []
  }

  for (const line of text.split('\n')) {
    if (!fence.push(line) && line.trim() === '') {
      flush()
      continue
    }
    current.push(line)
  }
  flush()
  return paragraphs
}

/**
 * Split a paragraph at every heading inside it.
 *
 * Markdown does not require a blank line before a heading, and models routinely
 * run their sections together. Only the first line of a paragraph was read as a
 * title, so `## Inspect\n...\n## Compare\n...` arrived as one step with the
 * second section buried in its body.
 */
function splitHeadings(paragraph: string): string[] {
  const sections: string[] = []
  let current: string[] = []
  const fence = fenceTracker()

  for (const line of paragraph.split('\n')) {
    // Read before the line is fed in: a heading inside a code block is code,
    // and a fence delimiter is never a heading.
    const inCode = fence.open
    fence.push(line)
    if (!inCode && current.length > 0 && headingOf(line) !== undefined) {
      sections.push(current.join('\n'))
      current = []
    }
    current.push(line)
  }

  if (current.length > 0) sections.push(current.join('\n'))
  return sections
}

function headingOf(line: string): string | undefined {
  for (const pattern of HEADING_PATTERNS) {
    const match = pattern.exec(line)
    if (match) return match[1].trim()
  }
  return undefined
}

/**
 * Split a reasoning stream into the steps it reads as.
 *
 * Models that structure their thinking mark each step with a heading; those
 * become titled steps. Everything else falls back to one step per paragraph, so
 * an unstructured stream still gets the same timeline treatment instead of
 * arriving as an undifferentiated wall of text.
 */
export function parseReasoningSteps(text: string): ReasoningStep[] {
  const steps: ReasoningStep[] = []

  for (const paragraph of splitParagraphs(text)) {
    for (const section of splitHeadings(paragraph)) {
      const [firstLine, ...rest] = section.split('\n')
      const title = headingOf(firstLine)

      if (title === undefined) {
        // A section with no heading continues the step above it, if that step
        // is still just a title waiting for its body.
        const previous = steps.at(-1)
        if (previous?.title !== undefined && previous.body === '') {
          previous.body = section
        } else {
          steps.push({ body: section })
        }
        continue
      }

      steps.push({ title, body: rest.join('\n').trim() })
    }
  }

  return steps
}
