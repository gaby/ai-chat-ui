export interface ReasoningStep {
  /** Heading the model gave this step, when it gave one. */
  title?: string
  body: string
}

const HEADING_PATTERNS = [
  /^#{1,6}\s+(.+?)\s*$/, // markdown heading
  /^\*\*(.+?)\*\*[:.]?\s*$/, // a bolded line on its own
]

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
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')

  const steps: ReasoningStep[] = []

  for (const paragraph of paragraphs) {
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
