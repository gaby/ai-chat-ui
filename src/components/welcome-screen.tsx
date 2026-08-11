import { BookOpenIcon, LightbulbIcon, TerminalIcon, WrenchIcon, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import logoSvg from '@/assets/logo.svg'

export interface Suggestion {
  icon: LucideIcon
  label: string
  prompt: string
}

// Deliberately generic: this shell ships as a package, so the defaults have to
// read sensibly for any pydantic-ai agent behind it. A host that knows its
// agent can pass its own list.
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { icon: LightbulbIcon, label: 'Explain a concept', prompt: 'Explain how ' },
  {
    icon: WrenchIcon,
    label: 'List your tools',
    prompt: 'What tools do you have access to, and when do you use each one?',
  },
  { icon: BookOpenIcon, label: 'Search the docs', prompt: 'Search the documentation for ' },
  { icon: TerminalIcon, label: 'Write some code', prompt: 'Write a Python function that ' },
]

interface WelcomeScreenProps {
  onSelect: (prompt: string) => void
  /** The composer, rendered inline so an empty chat opens on one centred column. */
  composer?: ReactNode
  suggestions?: Suggestion[]
}

/**
 * First-run view for an empty conversation. An empty chat with only a text box
 * gives no sense of what the agent is for, so this states the purpose, puts the
 * composer where the eye already is, and offers a few one-click ways in.
 */
export function WelcomeScreen({ onSelect, composer, suggestions = DEFAULT_SUGGESTIONS }: WelcomeScreenProps) {
  return (
    <div className="animate-fade-in mx-auto flex w-full max-w-3xl flex-col items-center px-4 text-center">
      <img src={logoSvg} alt="" className="mb-5 size-11" />
      {/* h2: the header's conversation title is the page's h1. */}
      <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">How can I help?</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm text-balance">
        Ask anything below. The agent can reason, call tools, and show its work as it goes.
      </p>

      {composer && <div className="mt-7 w-full">{composer}</div>}

      <ul className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.label}>
            <button
              type="button"
              onClick={() => {
                onSelect(suggestion.prompt)
              }}
              className="text-muted-foreground hover:border-primary/40 hover:bg-accent/50 hover:text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <suggestion.icon className="text-primary size-3.5" />
              {suggestion.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
