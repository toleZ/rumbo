import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { Menu, Plus } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { NotificationBell } from './NotificationBell'
import type { Page } from '../../types'

// Mirrors the sidebar's nav labels so the bar title and the drawer entry for
// the same view never disagree.
const PAGE_TITLE_KEYS: Record<Page, string> = {
  today: 'nav.today',
  kanban: 'nav.board',
  list: 'nav.list',
  calendar: 'nav.calendar',
  notes: 'nav.notes',
  habits: 'nav.habits',
  // Settings has no nav.* entry — it is reached from the user row, not the nav
  // list — so it reuses the sidebar label rather than duplicating the string.
  settings: 'sidebar.settings',
}

/**
 * The app shell's header below md, where the sidebar has collapsed into a
 * drawer and there is otherwise nothing on screen to open it, tell you which
 * view you are in, or reach Quick Add (previously Ctrl+Shift+A only).
 *
 * Rendered unconditionally and hidden with `md:hidden` rather than gated on
 * useIsMobile(): keeping it in the tree means no mount/unmount churn (and no
 * remounting NotificationBell's subscription) when a desktop window is resized
 * across the breakpoint.
 */
export function MobileTopBar() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { page, toggleSidebar, setQuickAddOpen } = useUIStore(useShallow(s => ({
    page: s.page,
    toggleSidebar: s.toggleSidebar,
    setQuickAddOpen: s.setQuickAddOpen,
  })))

  return (
    <header
      className="md:hidden shrink-0 flex items-center gap-1 bg-[var(--surface)] border-b border-[var(--sep)]"
      style={{
        paddingTop: 'var(--safe-t)',
        paddingLeft: 'calc(0.5rem + var(--safe-l))',
        paddingRight: 'calc(0.5rem + var(--safe-r))',
        height: 'calc(3.5rem + var(--safe-t))',
      }}
    >
      <button
        onClick={toggleSidebar}
        className="tap-target p-2 rounded-[var(--radius-md)] text-[var(--label-2)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
        aria-label={t('sidebar.openSidebar')}
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="flex-1 min-w-0 truncate text-base font-semibold text-[var(--label)] tracking-tight">
        {t(PAGE_TITLE_KEYS[page])}
      </h1>

      <button
        onClick={() => setQuickAddOpen(true)}
        className="tap-target p-2 rounded-[var(--radius-md)] text-[var(--label-2)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
        aria-label={t('quickAdd.title')}
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Gated on the hook rather than the wrapper's md:hidden: the header is
          always mounted (see above), so a CSS-hidden bell would still hold a
          second reminder subscription alongside the sidebar's. */}
      {isMobile && <NotificationBell />}
    </header>
  )
}
