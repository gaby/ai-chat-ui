import { ToolSection } from '@/components/tool-section'

/**
 * A failed tool call, shown where it happened.
 *
 * The message reads inline, in the card it belongs to: it is the one thing that
 * explains why the run went the way it did, so it is not worth a click and a
 * context switch to reach.
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
