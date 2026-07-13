import { useUIStore } from '../../stores/uiStore'
import { Sidebar } from './Sidebar'
import { ReminderWatcher } from './ReminderWatcher'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const sidebarOpen = useUIStore(s => s.sidebarOpen)

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--bg)]">
      <ReminderWatcher />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-[8px] focus:text-sm focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main
        id="main-content"
        className={`flex-1 overflow-auto main-content ${
          sidebarOpen ? 'ml-[240px]' : 'ml-12'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
