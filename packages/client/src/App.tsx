import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { trpc, createTRPCClient, refreshAccessToken, logoutServer } from './lib/trpc'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './stores/authStore'
import { useUIStore } from './stores/uiStore'
import { useChatStore } from './stores/chatStore'
import { useTaskStore } from './stores/taskStore'
import { useNoteStore } from './stores/noteStore'
import { useHabitStore } from './stores/habitStore'

import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/layout/Layout'
import { QuickAddTask } from './components/layout/QuickAddTask'
const TodayPage   = lazy(() => import('./components/today/TodayPage').then(m => ({ default: m.TodayPage })))
const KanbanBoard = lazy(() => import('./components/kanban/KanbanBoard').then(m => ({ default: m.KanbanBoard })))
const ListPage    = lazy(() => import('./components/list/ListPage').then(m => ({ default: m.ListPage })))
const NotesPage   = lazy(() => import('./components/notes/NotesPage').then(m => ({ default: m.NotesPage })))
const CalendarPage = lazy(() => import('./components/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })))
const HabitsPage  = lazy(() => import('./components/habits/HabitsPage').then(m => ({ default: m.HabitsPage })))
import { ActionRing } from './components/ring/ActionRing'
import { DataLoader } from './components/layout/DataLoader'

import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { VerifyPage } from './pages/VerifyPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LandingPage } from './pages/LandingPage'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { BetaPage } from './pages/BetaPage'

const trpcClient = createTRPCClient({
  getToken: () => useAuthStore.getState().accessToken,
  onNewToken: (token) => useAuthStore.getState().setAccessToken(token),
  onSessionExpired: () => useAuthStore.getState().clearSession(),
})

function AppContent() {
  const page = useUIStore(s => s.page)

  return (
    <>
      <DataLoader>
        <Layout>
          <Suspense fallback={
            <div className="h-full flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            </div>
          }>
            {page === 'today' && <TodayPage />}
            {page === 'kanban' && <KanbanBoard />}
            {page === 'list' && <ListPage />}
            {page === 'calendar' && <CalendarPage />}
            {page === 'notes' && <NotesPage />}
            {page === 'habits' && <HabitsPage />}
          </Suspense>
        </Layout>
      </DataLoader>
      <QuickAddTask />
      <ActionRing />
    </>
  )
}

function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const page = useUIStore(s => s.page)
  return <ErrorBoundary key={`${pathname}-${page}`}>{children}</ErrorBoundary>
}

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

function ScrollToHash() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const id = hash.slice(1)
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => clearTimeout(t)
  }, [hash])
  return null
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div role="status" aria-label="Cargando" className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)

  // Wait for startup refresh to settle — prevents bouncing /login → / → spinner → /login
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div role="status" aria-label="Cargando" className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (user) return <Navigate to="/app" replace />
  return <>{children}</>
}

function App() {
  const theme = useUIStore((s) => s.theme)

  // Apply dark/light class on <html> globally — must be here, not in AppContent,
  // so auth pages (login, register, etc.) also respect the stored theme preference.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  // Clear the query cache AND all per-user in-memory stores when authStore signals
  // a session end (login/logout/reset). Without the store reset, a previous user's
  // data (e.g. the AI chat) bleeds into the next user's session in the same tab.
  // This keeps authStore free of infrastructure/store imports.
  useEffect(() => {
    const handler = () => {
      queryClient.clear()
      useChatStore.getState().reset()
      useTaskStore.getState().reset()
      useNoteStore.getState().reset()
      useHabitStore.getState().reset()
    }
    window.addEventListener('auth:session-cleared', handler)
    return () => window.removeEventListener('auth:session-cleared', handler)
  }, [])

  // On startup: restore the session from the httpOnly cookie, or clear it if the
  // browser was closed and the user didn't want to be remembered.
  useEffect(() => {
    const { user, accessToken } = useAuthStore.getState()
    if (!user) return

    const rememberMePref = localStorage.getItem('rememberMePref')
    const sessionAlive = sessionStorage.getItem('sessionAlive')

    // Guard for legacy sessions: if authUser ended up in localStorage but rememberMe=false
    // and sessionAlive is gone, the browser was closed → clear the session.
    // (New sessions write authUser to sessionStorage directly, so this handles old data.)
    if (rememberMePref === 'false' && !sessionAlive && localStorage.getItem('authUser')) {
      logoutServer() // clean up server-side token async; don't await
      useAuthStore.getState().clearSession()
      return
    }

    if (!accessToken) {
      refreshAccessToken().then((token) => {
        if (token) useAuthStore.getState().setAccessToken(token)
        else useAuthStore.getState().clearSession()
      })
    }
  }, [])

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Toaster
            position="bottom-left"
            gutter={8}
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '10px',
                background: 'var(--surface)',
                color: 'var(--label)',
                border: '1px solid var(--sep)',
                fontSize: '14px',
                padding: '10px 14px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                maxWidth: '360px',
              },
              success: { duration: 3000, iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error: { duration: 5000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
          <ScrollToTop />
          <ScrollToHash />
          <Routes>
            {/* Marketing pages — always public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/beta" element={<BetaPage />} />

            {/* Auth pages — redirect to /app if already logged in */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/verify" element={<PublicRoute><VerifyPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

            {/* Protected app — moved from /* to /app/* */}
            <Route path="/app/*" element={<ProtectedRoute><AppErrorBoundary><AppContent /></AppErrorBoundary></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  )
}

export default App
