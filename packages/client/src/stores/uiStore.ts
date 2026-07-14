import { create } from 'zustand'
import type { Page, Theme, CalendarView } from '../types'

type Language = 'es' | 'en'

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
  theme: Theme
  language: Language
  sidebarOpen: boolean
  calendarView: CalendarView
  calendarDate: string
  selectedTaskId: string | null
  calendarVisibleBoardIds: string[]
  createBoardModalOpen: boolean
  setPage: (page: Page) => void
  toggleTheme: () => void
  setLanguage: (lang: Language) => void
  toggleSidebar: () => void
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
}

function detectLanguage(): Language {
  const stored = localStorage.getItem('language')
  if (stored === 'es' || stored === 'en') return stored as Language
  const browser = navigator.language?.slice(0, 2).toLowerCase()
  return browser === 'en' ? 'en' : 'es'
}

export const useUIStore = create<UIState>((set) => ({
  page: 'today',
  theme: (typeof window !== 'undefined' && localStorage.getItem('theme') as Theme) || 'light',
  language: detectLanguage(),
  sidebarOpen: true,
  calendarView: 'monthly',
  calendarDate: new Date().toISOString(),
  selectedTaskId: null,
  calendarVisibleBoardIds: loadVisibleBoards() ?? [],
  createBoardModalOpen: false,

  setPage: (page) => set({ page }),
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
}))
