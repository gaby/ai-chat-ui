import type { ReactNode } from 'react'

import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/utils'

interface ToolSectionProps {
  label: string
  /** Raw text behind the section, offered as a copy action when present. */
  copyText?: string
  children: ReactNode
  className?: string
  /** Extra classes for the content box the copy action sits in. */
  contentClassName?: string
}

/**
 * One labelled band inside an expanded tool card — Arguments, Result, Error.
 *
 * The label is what lets a reader skim a long agent run without parsing JSON,
 * and each band carries its own copy action because the thing people do with a
 * tool payload is take it somewhere else. The action sits in the corner of the
 * content it copies, the way a code block's does, rather than floating above
 * next to the label where it is ambiguous which block it belongs to.
 */
export function ToolSection({ label, copyText, children, className, contentClassName }: ToolSectionProps) {
  return (
    <section className={cn('border-t px-3 py-2.5', className)}>
      <h4 className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">{label}</h4>
      <div className={cn('group/content relative overflow-hidden rounded-md', contentClassName)}>
        {copyText && (
          <div className="absolute top-1 right-1 z-10 opacity-0 transition-opacity group-hover/content:opacity-100 focus-within:opacity-100">
            <CopyButton text={copyText} label={`Copy ${label.toLowerCase()}`} />
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
