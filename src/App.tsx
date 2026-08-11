import { useEffect, useState } from 'react'
import Chat from './Chat.tsx'
import { AppHeader } from './components/app-header.tsx'
import { AppSidebar } from './components/app-sidebar.tsx'
import { ThemeProvider } from './components/theme-provider.tsx'
import { SidebarInset, SidebarProvider } from './components/ui/sidebar.tsx'
import { Toaster } from './components/ui/sonner.tsx'
import { TooltipProvider } from './components/ui/tooltip.tsx'
import { migrateFromLocalStorage } from './lib/chat-db.ts'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    migrateFromLocalStorage()
      .catch((err: unknown) => {
        console.error('Migration failed:', err)
      })
      .finally(() => {
        setReady(true)
      })
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="pydantic-chat-ui-theme">
        <SidebarProvider defaultOpen>
          <AppSidebar />

          <SidebarInset className="h-svh min-w-0 overflow-hidden">
            {/* Nested inside SidebarProvider on purpose: that component wraps
                its children in a TooltipProvider of its own at delayDuration 0,
                so a provider above it would have no effect here. */}
            <TooltipProvider delayDuration={300}>
              <AppHeader />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">{ready && <Chat />}</div>
            </TooltipProvider>
          </SidebarInset>
        </SidebarProvider>
      </ThemeProvider>
      <Toaster richColors />
    </QueryClientProvider>
  )
}
