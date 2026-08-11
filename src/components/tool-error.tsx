import { ToolSection } from '@/components/tool-section'

/**
 * A failed tool call, shown where it happened.
 *
 * The message used to sit behind a "View Error" button that opened a modal —
 * two clicks and a context switch to read the one thing that explains why the
 * run went the way it did. It reads inline now, in the card it belongs to.
 */
export function ToolError({ errorText }: { errorText: string }) {
  return (
    <ToolSection
      label="Error"
      copyText={errorText}
      className="border-destructive/20 bg-destructive/5"
      contentClassName="bg-destructive/5"
    >
      <pre className="text-destructive max-h-64 overflow-auto p-2 pr-9 font-mono text-xs break-words whitespace-pre-wrap">
        {errorText}
      </pre>
    </ToolSection>
  )
}
