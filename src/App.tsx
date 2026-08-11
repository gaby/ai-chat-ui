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
      .then((migrated) => {
        if (migrated) {
          window.dispatchEvent(new Event('conversations-changed'))
        }
      })
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
        <TooltipProvider delayDuration={300}>
          <SidebarProvider defaultOpen>
            <AppSidebar />

            <SidebarInset className="h-svh min-w-0 overflow-hidden">
              <AppHeader />
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">{ready && <Chat />}</div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
      <Toaster richColors />
    </QueryClientProvider>
  )
}
