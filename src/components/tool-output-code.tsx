import { CodeBlock } from '@/components/ai-elements/code-block'
import { memo, useMemo } from 'react'

// Avoid running two Prism highlighters over very large tool payloads.
const LARGE_TOOL_OUTPUT_LENGTH = 20_000

// Memoize to avoid re-running highlighters on unchanged code.
const CodeBlockMemo = memo(CodeBlock)

/** Tool payloads as text — for the code block below, and for copying. */
export function stringifyToolOutput(output: unknown): string {
  try {
    const stringified: unknown = JSON.stringify(output, null, 2)
    return typeof stringified === 'string' ? stringified : String(output)
  } catch {
    return String(output)
  }
}

export function ToolOutputCode({ output }: { output: unknown }) {
  const code = useMemo(() => stringifyToolOutput(output), [output])

  if (code.length > LARGE_TOOL_OUTPUT_LENGTH) {
    return <pre className="max-h-96 overflow-auto p-4 font-mono text-xs whitespace-pre-wrap break-words">{code}</pre>
  }

  return <CodeBlockMemo code={code} language="json" />
}
