import { create } from 'zustand'
import type { Page, Theme, CalendarView } from '../types'
import { MOBILE_QUERY } from '../hooks/useMediaQuery'

type Language = 'es' | 'en'

const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches

const CALENDAR_VISIBLE_KEY = 'calendar_visible_boards'

function loadVisibleBoards(): string[] | null {
  try {
    const raw = localStorage.getItem(CALENDAR_VISIBLE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch { return null }
}

function saveVisibleBoards(ids: string[]) {
  try { localStorage.setItem(CALENDAR_VISIBLE_KEY, JSON.stringify(ids)) } catch {}
}

interface UIState {
  page: Page
  // Previous interior view — lets AppContent slide the entering view from the
  // correct direction (nav order) on page switches.
  prevPage: Page | null
  theme: Theme
  language: Language
  sidebarOpen: boolean
  calendarView: CalendarView
  calendarDate: string
  selectedTaskId: string | null
  calendarVisibleBoardIds: string[]
  createBoardModalOpen: boolean
  // Lifted out of QuickAddTask's local state so a visible trigger (the mobile
  // top bar) can open it — it used to be reachable only via Ctrl+Shift+A,
  // which made the feature unusable without a keyboard.
  quickAddOpen: boolean
  notificationsEnabled: boolean
  setPage: (page: Page) => void
  toggleTheme: () => void
  setLanguage: (lang: Language) => void
  setNotificationsEnabled: (enabled: boolean) => void
  toggleSidebar: () => void
  closeSidebar: () => void
  setCalendarView: (view: CalendarView) => void
  setCalendarDate: (date: string) => void
  setSelectedTaskId: (id: string | null) => void
  setCalendarVisibleBoards: (ids: string[]) => void
  // Called by taskStore.hydrate — reconciles stored visibility with current board IDs
  syncCalendarBoards: (boardIds: string[]) => void
  addCalendarBoard: (id: string) => void
  removeCalendarBoard: (id: string) => void
  openCreateBoardModal: () => void
  closeCreateBoardModal: () => void
  setQuickAddOpen: (open: boolean) => void
}

function detectLanguage(): Language {
  const stored = localStorage.getItem('language')
  if (stored === 'es' || stored === 'en') return stored as Language
  const browser = navigator.language?.slice(0, 2).toLowerCase()
  return browser === 'en' ? 'en' : 'es'
}

export const useUIStore = create<UIState>((set) => ({
  page: 'today',
  prevPage: null,
  theme: (typeof window !== 'undefined' && localStorage.getItem('theme') as Theme) || 'light',
  language: detectLanguage(),
  // Below md the sidebar is an overlay drawer, so opening by default would
  // cover the content on first paint. Above md it is a persistent panel and
  // open is the right resting state.
  sidebarOpen: !isMobileViewport(),
  calendarView: 'monthly',
  calendarDate: new Date().toISOString(),
  selectedTaskId: null,
  calendarVisibleBoardIds: loadVisibleBoards() ?? [],
  createBoardModalOpen: false,
  quickAddOpen: false,
  notificationsEnabled: (typeof window !== 'undefined' ? localStorage.getItem('notificationsEnabled') : null) !== 'false',

  setPage: (page) =>
    set((state) => ({
      page,
      prevPage: state.page,
      // On mobile the drawer sits on top of the view being navigated to;
      // leaving it open would hide the result of the tap. On desktop it is
      // persistent chrome and must not move.
      sidebarOpen: isMobileViewport() ? false : state.sidebarOpen,
    })),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', newTheme)
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
      document.documentElement.classList.toggle('light', newTheme === 'light')
      return { theme: newTheme }
    }),
  setLanguage: (lang) => {
    localStorage.setItem('language', lang)
    // i18n.changeLanguage is called by the LanguageToggle component
    set({ language: lang })
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  setCalendarView: (calendarView) => set({ calendarView }),
  setCalendarDate: (calendarDate) => set({ calendarDate }),

  setCalendarVisibleBoards: (ids) => {
    saveVisibleBoards(ids)
    set({ calendarVisibleBoardIds: ids })
  },
  syncCalendarBoards: (boardIds) => {
    const stored = loadVisibleBoards()
    const visibleIds = stored ? stored.filter((id) => boardIds.includes(id)) : boardIds
    const newBoards = boardIds.filter((id) => !stored || !stored.includes(id))
    const finalIds = [...visibleIds, ...newBoards]
    saveVisibleBoards(finalIds)
    set({ calendarVisibleBoardIds: finalIds })
  },
  addCalendarBoard: (id) =>
    set((state) => {
      const ids = [...state.calendarVisibleBoardIds, id]
      saveVisibleBoards(ids)
      return { calendarVisibleBoardIds: ids }
    }),
  removeCalendarBoard: (id) =>
    set((state) => {
      const ids = state.calendarVisibleBoardIds.filter((bid) => bid !== id)
      saveVisibleBoards(ids)
      return { calendarVisibleBoardIds: ids }
    }),
  openCreateBoardModal: () => set({ createBoardModalOpen: true }),
  closeCreateBoardModal: () => set({ createBoardModalOpen: false }),
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),

  setNotificationsEnabled: (enabled) => {
    localStorage.setItem('notificationsEnabled', String(enabled))
    set({ notificationsEnabled: enabled })
  },
}))
