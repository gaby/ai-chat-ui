import type { ReactNode } from 'react'

import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/utils'

interface ToolSectionProps {
  label: string
  /** Raw text behind the section, offered as a copy action when present. */
  copyText?: string
  children: ReactNode
  className?: string
}

/**
 * One labelled band inside an expanded tool card — Arguments, Result, Error.
 *
 * The label is what lets a reader skim a long agent run without parsing JSON,
 * and each band carries its own copy action because the thing people do with a
 * tool payload is take it somewhere else.
 */
export function ToolSection({ label, copyText, children, className }: ToolSectionProps) {
  return (
    <section className={cn('group/section border-t px-3 py-2.5', className)}>
      <div className="mb-1.5 flex h-6 items-center justify-between gap-2">
        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</h4>
        {copyText && (
          <span className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
            <CopyButton text={copyText} label={`Copy ${label.toLowerCase()}`} />
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
