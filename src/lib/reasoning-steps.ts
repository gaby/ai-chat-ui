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
 */
function splitParagraphs(text: string): string[] {
  const paragraphs: string[] = []
  let current: string[] = []
  let inFence = false

  const flush = () => {
    const paragraph = current.join('\n').trim()
    if (paragraph !== '') paragraphs.push(paragraph)
    current = []
  }

  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (!inFence && line.trim() === '') {
      flush()
      continue
    }
    current.push(line)
  }
  flush()
  return paragraphs
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
    const [firstLine, ...rest] = paragraph.split('\n')
    const title = headingOf(firstLine)

    if (title === undefined) {
      // A paragraph with no heading continues the step above it, if that step
      // is still just a title waiting for its body.
      const previous = steps.at(-1)
      if (previous?.title !== undefined && previous.body === '') {
        previous.body = paragraph
      } else {
        steps.push({ body: paragraph })
      }
      continue
    }

    steps.push({ title, body: rest.join('\n').trim() })
  }

  return steps
}
