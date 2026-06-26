import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useNavigate } from 'react-router-dom'
import {
  Home, CalendarDays, StickyNote, PanelLeftClose, PanelLeft, Plus,
  MoreHorizontal, Pencil, Trash2, Kanban, Target, Sun, Palette, LogOut, User,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { useAuthStore } from '../../stores/authStore'
import { trpc } from '../../lib/trpc'
import { ThemeToggle } from './ThemeToggle'
import { LanguageToggle } from './LanguageToggle'
import { BoardTemplateModal } from '../kanban/BoardTemplateModal'
import toast from 'react-hot-toast'
import type { Page } from '../../types'

const BOARD_COLORS = [
  null, '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

export function Sidebar() {
  const { t } = useTranslation()
  const { page, setPage, sidebarOpen, toggleSidebar, createBoardModalOpen, openCreateBoardModal, closeCreateBoardModal } = useUIStore(useShallow(s => ({
    page: s.page,
    setPage: s.setPage,
    sidebarOpen: s.sidebarOpen,
    toggleSidebar: s.toggleSidebar,
    createBoardModalOpen: s.createBoardModalOpen,
    openCreateBoardModal: s.openCreateBoardModal,
    closeCreateBoardModal: s.closeCreateBoardModal,
  })))
  const { boards, columns, tasks, activeBoardId, renameBoard, updateBoardColor, deleteBoard, setActiveBoard } = useTaskStore(useShallow(s => ({
    boards: s.boards,
    columns: s.columns,
    tasks: s.tasks,
    activeBoardId: s.activeBoardId,
    renameBoard: s.renameBoard,
    updateBoardColor: s.updateBoardColor,
    deleteBoard: s.deleteBoard,
    setActiveBoard: s.setActiveBoard,
  })))
  const { user, clearSession } = useAuthStore()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showBoardMenu, setShowBoardMenu] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null)

  const navItems: { id: Page; labelKey: string; icon: typeof Home }[] = [
    { id: 'home',     labelKey: 'nav.home',     icon: Home },
    { id: 'today',    labelKey: 'nav.today',    icon: Sun },
    { id: 'kanban',   labelKey: 'nav.board',    icon: Kanban },
    { id: 'calendar', labelKey: 'nav.calendar', icon: CalendarDays },
    { id: 'notes',    labelKey: 'nav.notes',    icon: StickyNote },
    { id: 'habits',   labelKey: 'nav.habits',   icon: Target },
  ]

  const logoutMutation = trpc.auth.logout.useMutation({
    onSettled: () => {
      navigate('/login')
      toast.success(t('sidebar.loggedOut'))
    },
  })

  const createBoardMutation = trpc.boards.create.useMutation({
    onSuccess: (data) => {
      // Keep the boards.list cache in sync so DataLoader reads the updated list
      // when the ErrorBoundary remounts on page change (staleTime: Infinity means
      // the cache won't be refetched — we must patch it manually).
      utils.boards.list.setData(undefined, (old) => [...(old ?? []), data])
      useTaskStore.setState((s) => ({
        boards: [...s.boards, {
          id: data.id, name: data.name, color: data.color ?? null,
          order: data.order, createdAt: new Date(data.createdAt).toISOString(),
        }],
        columns: [...s.columns, ...(data.columns ?? []).map((c: any) => ({
          id: c.id, title: c.title, boardId: c.boardId, order: c.order,
        }))],
        activeBoardId: data.id,
      }))
      setPage('kanban')
    },
    onError: () => toast.error(t('sidebar.failedCreateBoard')),
  })

  const updateBoardMutation = trpc.boards.update.useMutation()
  const deleteBoardMutation = trpc.boards.delete.useMutation()

  const handleLogout = () => {
    clearSession()
    logoutMutation.mutate()
  }

  const handleRenameBoard = (id: string) => {
    if (!editingName.trim()) return
    const board = boards.find((b) => b.id === id)
    if (!board) return
    const snapshot = board.name
    renameBoard(id, editingName.trim())
    setEditingBoardId(null)
    setEditingName('')
    updateBoardMutation.mutate({ id, name: editingName.trim() }, {
      onError: () => {
        renameBoard(id, snapshot)
        toast.error(t('sidebar.failedRenameBoard'))
      },
    })
  }

  const handleDeleteBoard = (id: string) => {
    const { boards: bSnap, columns: cSnap, tasks: tSnap } = useTaskStore.getState()
    const cacheSnap = utils.boards.list.getData()
    deleteBoard(id)
    utils.boards.list.setData(undefined, (old) => old?.filter((b) => b.id !== id) ?? [])
    deleteBoardMutation.mutate({ id }, {
      onError: () => {
        useTaskStore.setState({ boards: bSnap, columns: cSnap, tasks: tSnap })
        utils.boards.list.setData(undefined, cacheSnap)
        toast.error(t('sidebar.failedDeleteBoard'))
      },
    })
  }

  const handleDeleteBoardConfirm = (board: typeof boards[0]) => {
    setShowBoardMenu(null)
    const boardTasks = tasks.filter((task) =>
      columns.some((c) => c.boardId === board.id && c.id === task.columnId)
    ).length
    toast(
      (_t) => (
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--label)]">
            {t('sidebar.deleteBoardConfirm', {
            name: board.name,
            tasks: boardTasks > 0 ? t('sidebar.deleteBoardTasks', { count: boardTasks }) : '',
          })}
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => toast.dismiss(_t.id)}
              className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--surface-2)] text-[var(--label-2)] hover:bg-[var(--surface-3)] transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => { toast.dismiss(_t.id); handleDeleteBoard(board.id) }}
              className="text-xs px-2.5 py-1 rounded-[6px] bg-[var(--danger)] text-white hover:opacity-90 transition-opacity font-medium"
            >
              {t('sidebar.delete')}
            </button>
          </div>
        </div>
      ),
      { duration: 6000 },
    )
  }

  const handleColorChange = (boardId: string, color: string | null) => {
    const board = boards.find((b) => b.id === boardId)
    if (!board) return
    const snapshot = board.color
    updateBoardColor(boardId, color)
    setShowColorPicker(null)
    updateBoardMutation.mutate({ id: boardId, color: color ?? null }, {
      onError: () => {
        updateBoardColor(boardId, snapshot)
        toast.error(t('sidebar.failedUpdateColor'))
      },
    })
  }

  return (
    <>
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 rounded-[8px] bg-[var(--surface)] shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
          aria-label={t('sidebar.openSidebar')}
        >
          <PanelLeft className="w-5 h-5 text-[var(--label-2)]" />
        </button>
      )}

      <aside
        className={`fixed top-0 left-0 h-full sidebar-glass border-r border-[var(--sep)] flex flex-col sidebar-transition z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '240px' }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--sep)]">
          <h1 className="text-sm font-semibold text-[var(--label)] tracking-tight">
            {t('sidebar.appName')}
          </h1>
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-[8px] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
            aria-label={t('sidebar.closeSidebar')}
          >
            <PanelLeftClose className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <nav className="px-3 py-3 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-f)] text-[var(--accent)]'
                      : 'text-[var(--label-2)] hover:bg-[var(--surface-2)] hover:text-[var(--label)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(item.labelKey)}
                </button>
              )
            })}
          </nav>

          <div className="px-3 py-3 border-t border-[var(--sep)]">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold uppercase text-[var(--label-3)] tracking-wider">
                {t('sidebar.boards')}
              </span>
              <button
                onClick={openCreateBoardModal}
                className="p-1 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--label-3)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
                aria-label={t('sidebar.addBoard')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5">
              {boards
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((board) => (
                  <div key={board.id} className="relative group">
                    {editingBoardId === board.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameBoard(board.id)
                          if (e.key === 'Escape') setEditingBoardId(null)
                        }}
                        onBlur={() => handleRenameBoard(board.id)}
                        className="w-full px-3 py-1.5 text-sm rounded-[8px] bg-[var(--surface-2)] text-[var(--label)] border border-[var(--sep)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => { setActiveBoard(board.id); setPage('kanban') }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[8px] text-sm transition-colors ${
                          activeBoardId === board.id
                            ? 'bg-[var(--accent-f)] text-[var(--accent)] font-medium'
                            : 'text-[var(--label-2)] hover:bg-[var(--surface-2)] hover:text-[var(--label)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {board.color && (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: board.color }} />
                          )}
                          <span className="truncate">{board.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowBoardMenu(showBoardMenu === board.id ? null : board.id)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded-[4px] hover:bg-[var(--surface-3)] transition-opacity"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </button>
                    )}

                    {showBoardMenu === board.id && (
                      <div className="absolute right-0 top-7 z-20 w-40 bg-[var(--surface)] border border-[var(--sep)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-1 popover-enter">
                        <button
                          onClick={() => { setEditingBoardId(board.id); setEditingName(board.name); setShowBoardMenu(null) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> {t('sidebar.rename')}
                        </button>
                        <button
                          onClick={() => { setShowColorPicker(board.id); setShowBoardMenu(null) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors"
                        >
                          <Palette className="w-3 h-3" /> {t('sidebar.color')}
                        </button>
                        {boards.length > 1 && (
                          <button
                            onClick={() => handleDeleteBoardConfirm(board)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> {t('sidebar.delete')}
                          </button>
                        )}
                      </div>
                    )}

                    {showColorPicker === board.id && (
                      <div className="absolute right-0 top-7 z-20 bg-[var(--surface)] border border-[var(--sep)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] p-3 popover-enter">
                        <div className="flex gap-1.5 flex-wrap w-36">
                          {BOARD_COLORS.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => handleColorChange(board.id, c)}
                              aria-label={c ? t('sidebar.boardColorN', { color: c }) : t('sidebar.noColor')}
                              aria-pressed={board.color === c}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${
                                board.color === c ? 'border-[var(--accent)] scale-110' : 'border-[var(--sep)]'
                              } ${!c ? 'bg-[var(--surface-3)]' : ''}`}
                              style={c ? { backgroundColor: c } : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--sep)] space-y-2">
          {user && (
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--label)] truncate">{user.name || user.email}</p>
                {user.name && <p className="text-xs text-[var(--label-3)] truncate">{user.email}</p>}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--label-3)]">{t('sidebar.theme')}</span>
            <div className="flex items-center gap-1">
              <LanguageToggle />
              <ThemeToggle />
              {user && (
                <button
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="p-1.5 rounded-[8px] hover:bg-[var(--surface-2)] text-[var(--label-3)] hover:text-[var(--danger)] transition-colors"
                  title={t('sidebar.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {createBoardModalOpen && (
        <BoardTemplateModal
          onClose={closeCreateBoardModal}
          onSave={(name, color, cols) => {
            createBoardMutation.mutate({ name, color: color ?? null, columnTitles: cols })
            closeCreateBoardModal()
          }}
        />
      )}
    </>
  )
}
