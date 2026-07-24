import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../stores/uiStore'
import { Sidebar } from './Sidebar'
import { MobileTopBar } from './MobileTopBar'
import { ReminderWatcher } from './ReminderWatcher'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation()
  const sidebarOpen = useUIStore(s => s.sidebarOpen)

  return (
    // 100dvh, not h-screen: on iOS Safari 100vh is the tallest the viewport
    // ever gets, so with the URL bar shown the bottom of a h-screen +
    // overflow-hidden shell is permanently cut off and unreachable.
    <div className="flex overflow-hidden bg-[var(--bg)]" style={{ height: '100dvh' }}>
      <ReminderWatcher />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-white focus:rounded-[var(--radius-md)] focus:text-sm focus:font-medium focus:outline-none"
      >
        {t('a11y.skipToContent')}
      </a>
      <Sidebar />
      {/* Below md the sidebar is an overlay drawer, so main reserves no space
          for it at all — the previous unconditional ml-[240px] left 135px of
          usable width on a 375px phone. At md and up it reserves exactly the
          sidebar's own token width. */}
      <div
        className={`flex-1 flex flex-col min-w-0 main-content ${
          sidebarOpen ? 'md:ml-[var(--sidebar-w)]' : 'md:ml-12'
        }`}
      >
        <MobileTopBar />
        <main id="main-content" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
