import { BookOpenIcon, LightbulbIcon, TerminalIcon, WrenchIcon, type LucideIcon } from 'lucide-react'

import logoSvg from '@/assets/logo.svg'

export interface Suggestion {
  icon: LucideIcon
  label: string
  description: string
  prompt: string
}

// Deliberately generic: this shell ships as a package, so the defaults have to
// read sensibly for any pydantic-ai agent behind it. A host that knows its
// agent can pass its own list.
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    icon: LightbulbIcon,
    label: 'Explain a concept',
    description: 'Get a clear walkthrough of an idea',
    prompt: 'Explain how ',
  },
  {
    icon: WrenchIcon,
    label: 'List your tools',
    description: 'See what this agent can do',
    prompt: 'What tools do you have access to, and when do you use each one?',
  },
  {
    icon: BookOpenIcon,
    label: 'Search the docs',
    description: 'Look something up and cite it',
    prompt: 'Search the documentation for ',
  },
  {
    icon: TerminalIcon,
    label: 'Write some code',
    description: 'Draft a snippet and explain it',
    prompt: 'Write a Python function that ',
  },
]

interface WelcomeScreenProps {
  onSelect: (prompt: string) => void
  suggestions?: Suggestion[]
}

/**
 * First-run view for an empty conversation. An empty chat with only a text box
 * gives no sense of what the agent is for, so this states the purpose and
 * offers a few one-click ways in.
 */
export function WelcomeScreen({ onSelect, suggestions = DEFAULT_SUGGESTIONS }: WelcomeScreenProps) {
  return (
    <div className="animate-fade-in mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-10 text-center">
      <img src={logoSvg} alt="" className="mb-5 size-11" />
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">How can I help?</h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm text-balance">
        Ask anything below. The agent can reason, call tools, and show its work as it goes.
      </p>

      <ul className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.label}>
            <button
              type="button"
              onClick={() => {
                onSelect(suggestion.prompt)
              }}
              className="hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-ring group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="bg-muted text-muted-foreground group-hover:text-primary flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors">
                <suggestion.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{suggestion.label}</span>
                <span className="text-muted-foreground block truncate text-xs">{suggestion.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
