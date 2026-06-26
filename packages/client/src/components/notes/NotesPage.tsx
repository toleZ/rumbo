import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Plus, Trash2, FolderPlus, ChevronRight, ChevronDown, FileText, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading1, Heading2, Pencil, Search, X, FolderInput, Loader2, Check, AlertCircle, Circle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useNoteStore } from '../../stores/noteStore'
import { trpc } from '../../lib/trpc'
import toast from 'react-hot-toast'
import type { Note } from '../../types'

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

export function NotesPage() {
  const { t } = useTranslation()
  const { notes, folders, activeNoteId, updateNote, deleteNote, setActiveNote, renameFolder, deleteFolder, moveNoteToFolder } = useNoteStore(useShallow(s => ({
    notes: s.notes,
    folders: s.folders,
    activeNoteId: s.activeNoteId,
    updateNote: s.updateNote,
    deleteNote: s.deleteNote,
    setActiveNote: s.setActiveNote,
    renameFolder: s.renameFolder,
    deleteFolder: s.deleteFolder,
    moveNoteToFolder: s.moveNoteToFolder,
  })))
  const utils = trpc.useUtils()
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renamingFolderName, setRenamingFolderName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingStartedAtRef = useRef<number | null>(null)
  const activeNoteIdRef = useRef<string | null>(activeNoteId)
  const prevNoteIdRef = useRef<string | null>(null)
  // Prevents the noteContentQuery useEffect from calling setContent when the
  // cache update was triggered by onUpdate (user typing) rather than a server fetch.
  const skipNextSetContentRef = useRef(false)
  const activeNote = notes.find((n) => n.id === activeNoteId)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Minimum time the "Saving…" state is visible — prevents it flashing so fast
  // it's never seen on localhost where the round-trip is <1ms.
  const MIN_SAVING_MS = 600

  const markSaved = () => {
    const elapsed = savingStartedAtRef.current ? Date.now() - savingStartedAtRef.current : MIN_SAVING_MS
    const delay = Math.max(0, MIN_SAVING_MS - elapsed)
    setTimeout(() => {
      setSaveStatus('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    }, delay)
  }

  const markSaving = () => {
    savingStartedAtRef.current = Date.now()
    setSaveStatus('saving')
  }

  // Keep ref in sync so the onUpdate closure always reads the current note id
  // without needing to recreate the editor.
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId
  }, [activeNoteId])

  // Filtered notes for search
  const filteredNotes = searchQuery.trim()
    ? notes.filter((n) => (n.title || t('notes.untitled')).toLowerCase().includes(searchQuery.toLowerCase()))
    : null

  // Fetch full note content lazily when a note is selected
  const noteContentQuery = trpc.notes.get.useQuery(
    { id: activeNoteId! },
    { enabled: !!activeNoteId, staleTime: Infinity }
  )

  const createNoteMutation = trpc.notes.create.useMutation({
    onSuccess: (data) => {
      const note: Note = {
        id: data.id,
        title: data.title,
        folderId: data.folderId ?? null,
        createdAt: new Date(data.createdAt).toISOString(),
        updatedAt: new Date(data.updatedAt).toISOString(),
      }
      // Prime content cache so the editor loads immediately without a network fetch
      utils.notes.get.setData({ id: data.id }, data)
      useNoteStore.setState((s) => ({ notes: [note, ...s.notes], activeNoteId: note.id }))
    },
    onError: () => toast.error(t('notes.failedCreate')),
  })

  const updateNoteMutation = trpc.notes.update.useMutation({
    onSuccess: () => markSaved(),
    onError: () => {
      setSaveStatus('error')
      toast.error(t('notes.failedSave'))
    },
  })

  const deleteNoteMutation = trpc.notes.delete.useMutation({
    onError: () => toast.error(t('notes.failedDelete')),
  })

  const createFolderMutation = trpc.folders.create.useMutation({
    onSuccess: (data) => {
      useNoteStore.setState((s) => ({
        folders: [...s.folders, {
          id: data.id,
          name: data.name,
          parentId: data.parentId ?? null,
          order: data.order ?? 0,
        }],
      }))
    },
    onError: () => toast.error(t('notes.failedCreateFolder')),
  })

  const updateFolderMutation = trpc.folders.update.useMutation({
    onError: () => toast.error(t('notes.failedRenameFolder')),
  })

  const deleteFolderMutation = trpc.folders.delete.useMutation({
    onError: () => toast.error(t('notes.failedDeleteFolder')),
  })

  const moveNoteMutation = trpc.notes.update.useMutation({
    onError: () => toast.error(t('notes.failedMoveNote')),
  })

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const editor = useEditor({
    extensions: [StarterKit, Underline, Placeholder.configure({ placeholder: t('notes.startWriting') })],
    content: '',
    onUpdate: ({ editor }) => {
      const noteId = activeNoteIdRef.current
      if (!noteId) return
      const html = editor.getHTML()
      // Flag so the noteContentQuery useEffect doesn't call setContent for this update
      skipNextSetContentRef.current = true
      utils.notes.get.setData({ id: noteId }, (old: any) => old ? { ...old, content: html } : old)
      // Show 'unsaved' immediately so the user knows a save is pending
      setSaveStatus('unsaved')
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        markSaving()
        updateNoteMutation.mutate({ id: noteId, content: html })
      }, 800)
    },
  })

  // When active note changes: flush any pending save for the OLD note, then load new content
  useEffect(() => {
    // Flush pending save unconditionally — the editor's lifecycle must not interrupt
    // a save already in flight for the previous note.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      const prevId = prevNoteIdRef.current
      if (prevId) {
        const cached = utils.notes.get.getData({ id: prevId })
        if (cached?.content !== undefined) {
          updateNoteMutation.mutate({ id: prevId, content: cached.content })
        }
      }
    }

    // Reset save status so the previous note's state doesn't bleed into the new one
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    setSaveStatus('idle')

    // Record the old note id before moving to the new one
    prevNoteIdRef.current = activeNoteId

    // Editor content manipulation requires a live, non-destroyed instance
    if (!editor || editor.isDestroyed) return

    if (!activeNoteId) {
      editor.commands.setContent('')
      return
    }

    // Load content for the newly selected note from cache if available
    const cached = utils.notes.get.getData({ id: activeNoteId })
    if (cached?.content !== undefined) {
      editor.commands.setContent(cached.content, { emitUpdate: false })
    } else {
      // Content not yet cached — clear editor while fetch is in flight
      editor.commands.setContent('', { emitUpdate: false })
    }
  }, [activeNoteId])

  // Set editor content once fetch completes, or when the editor instance is recreated.
  // Tiptap v3 destroys and recreates the editor via a 1ms timer on mount (scheduleDestroy);
  // adding `editor` to deps ensures we reload content into the fresh instance.
  useEffect(() => {
    if (editor && !editor.isDestroyed && noteContentQuery.data !== undefined) {
      if (skipNextSetContentRef.current) {
        skipNextSetContentRef.current = false
        return
      }
      editor.commands.setContent(noteContentQuery.data.content ?? '', { emitUpdate: false })
    }
  }, [noteContentQuery.data, editor])

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedFolders(next)
  }

  const handleDeleteNote = (noteId: string) => {
    const noteSnapshot = notes.find((n) => n.id === noteId)!
    const activeSnapshot = activeNoteId
    deleteNote(noteId)
    deleteNoteMutation.mutate({ id: noteId }, {
      onError: () => {
        useNoteStore.setState((s) => ({ notes: [noteSnapshot, ...s.notes], activeNoteId: activeSnapshot }))
      },
    })
  }

  const handleDeleteFolder = (folderId: string) => {
    const foldersSnapshot = [...folders]
    const notesSnapshot = [...notes]
    deleteFolder(folderId)
    deleteFolderMutation.mutate({ id: folderId }, {
      onError: () => {
        useNoteStore.setState({ folders: foldersSnapshot, notes: notesSnapshot })
      },
    })
  }

  const handleRenameFolder = (id: string, name: string) => {
    if (!name.trim()) { setRenamingFolderId(null); return }
    const snapshot = folders.find((f) => f.id === id)!.name
    renameFolder(id, name.trim())
    setRenamingFolderId(null)
    updateFolderMutation.mutate({ id, name: name.trim() }, {
      onError: () => renameFolder(id, snapshot),
    })
  }

  const handleMoveNote = (noteId: string, folderId: string | null) => {
    const snapshot = notes.find((n) => n.id === noteId)?.folderId ?? null
    moveNoteToFolder(noteId, folderId)
    setMovingNoteId(null)
    moveNoteMutation.mutate({ id: noteId, folderId }, {
      onError: () => moveNoteToFolder(noteId, snapshot),
    })
  }

  const rootFolders = folders.filter((f) => !f.parentId)
  const rootNotes = notes.filter((n) => !n.folderId)

  const renderNoteRow = (n: typeof notes[0], indent = false) => (
    <div key={n.id} className="relative group">
      <button
        type="button"
        onClick={() => setActiveNote(n.id)}
        className={`w-full flex items-center gap-1.5 py-1 px-2 pr-14 rounded-[6px] text-left ${
          activeNoteId === n.id
            ? 'bg-[var(--accent-f)] text-[var(--accent)]'
            : 'hover:bg-[var(--surface-2)] text-[var(--label-2)]'
        } ${indent ? '' : ''}`}
      >
        <FileText className="w-3 h-3 shrink-0" />
        <span className="text-sm truncate">{n.title || t('notes.untitled')}</span>
      </button>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMovingNoteId(movingNoteId === n.id ? null : n.id) }}
          className="p-0.5 rounded hover:bg-[var(--surface-3)]"
          title={t('notes.moveToFolder')}
        >
          <FolderInput className="w-3 h-3 text-[var(--label-3)]" />
        </button>
        <button
          type="button"
          onClick={() => handleDeleteNote(n.id)}
          className="p-0.5 rounded hover:bg-[var(--surface-3)]"
        >
          <Trash2 className="w-3 h-3 text-[var(--label-3)]" />
        </button>
      </div>
      {/* Move-to-folder picker */}
      {movingNoteId === n.id && (
        <div className="absolute left-0 right-0 top-full z-50 bg-[var(--surface)] border border-[var(--sep)] rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.10)] py-1 mt-0.5">
          <button
            type="button"
            onClick={() => handleMoveNote(n.id, null)}
            className="w-full text-left px-3 py-1.5 text-xs text-[var(--label-2)] hover:bg-[var(--surface-2)] flex items-center gap-1.5"
          >
            <FileText className="w-3 h-3" /> {t('notes.noFolder')}
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleMoveNote(n.id, f.id)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--surface-2)] flex items-center gap-1.5 ${
                n.folderId === f.id ? 'text-[var(--accent)]' : 'text-[var(--label-2)]'
              }`}
            >
              <FolderInput className="w-3 h-3" /> {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const renderFolder = (folder: typeof folders[0]) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isRenaming = renamingFolderId === folder.id
    const childFolders = folders.filter((f) => f.parentId === folder.id)
    const childNotes = notes.filter((n) => n.folderId === folder.id)

    return (
      <div key={folder.id}>
        <div className="relative group">
          <button
            type="button"
            onClick={() => toggleFolder(folder.id)}
            disabled={isRenaming}
            aria-expanded={isExpanded}
            className="w-full flex items-center gap-1 py-1 px-2 pr-12 rounded-[6px] hover:bg-[var(--surface-2)] text-left"
          >
            {isExpanded
              ? <ChevronDown className="w-3 h-3 text-[var(--label-3)] shrink-0" />
              : <ChevronRight className="w-3 h-3 text-[var(--label-3)] shrink-0" />
            }
            {!isRenaming && (
              <span className="text-sm text-[var(--label)] truncate flex-1">{folder.name}</span>
            )}
          </button>
          {isRenaming && (
            <input
              type="text"
              value={renamingFolderName}
              onChange={(e) => setRenamingFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolder(folder.id, renamingFolderName)
                if (e.key === 'Escape') setRenamingFolderId(null)
              }}
              onBlur={() => handleRenameFolder(folder.id, renamingFolderName)}
              autoFocus
              className="absolute left-5 right-1 top-0.5 bottom-0.5 text-sm bg-[var(--surface-2)] text-[var(--label)] border border-[var(--accent)] rounded-[4px] px-1 focus:outline-none"
            />
          )}
          {!isRenaming && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => { setRenamingFolderId(folder.id); setRenamingFolderName(folder.name) }}
                className="p-0.5 rounded hover:bg-[var(--surface-3)]"
              >
                <Pencil className="w-3 h-3 text-[var(--label-3)]" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFolder(folder.id)}
                className="p-0.5 rounded hover:bg-[var(--surface-3)]"
              >
                <Trash2 className="w-3 h-3 text-[var(--label-3)]" />
              </button>
            </div>
          )}
        </div>
        {isExpanded && (
          <div className="ml-4">
            {childFolders.map(renderFolder)}
            {childNotes.map((n) => renderNoteRow(n))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex" onClick={() => movingNoteId && setMovingNoteId(null)}>
      {/* Notes sidebar */}
      <div className="w-60 border-r border-[var(--sep)] flex flex-col bg-[var(--bg-2)]">
        <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--sep)]">
          <span className="text-[10px] font-semibold uppercase text-[var(--label-3)] tracking-wider">{t('notes.sectionTitle')}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setShowNewFolder(true)}
              className="p-1 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--label-3)] transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => createNoteMutation.mutate({ title: t('notes.untitled'), content: '', folderId: null })}
              disabled={createNoteMutation.isPending}
              className="p-1 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--label-3)] transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--label-3)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('notes.search')}
              className="w-full pl-6 pr-6 py-1.5 text-xs rounded-[6px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--surface-3)]"
              >
                <X className="w-3 h-3 text-[var(--label-3)]" />
              </button>
            )}
          </div>
        </div>

        {showNewFolder && (
          <div className="px-3 py-2 border-b border-[var(--sep)]">
            <form onSubmit={(e) => {
              e.preventDefault()
              if (newFolderName.trim()) {
                createFolderMutation.mutate({ name: newFolderName.trim(), parentId: null })
                setNewFolderName('')
                setShowNewFolder(false)
              }
            }}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('notes.folderNamePlaceholder')}
                autoFocus
                className="w-full px-2 py-1.5 text-sm rounded-[6px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                onBlur={() => setShowNewFolder(false)}
              />
            </form>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* Search results — flat list */}
          {filteredNotes !== null ? (
            filteredNotes.length === 0 ? (
              <p className="text-xs text-[var(--label-3)] text-center py-4">{t('notes.noResults')}</p>
            ) : (
              filteredNotes.map((n) => renderNoteRow(n))
            )
          ) : (
            <>
              {rootFolders.map(renderFolder)}
              {rootNotes.map((n) => renderNoteRow(n))}
            </>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col bg-[var(--bg)]">
        {activeNote ? (
          <>
            {/* Note title + save status */}
            <div className="px-8 py-4 border-b border-[var(--sep)] flex items-center justify-between gap-4">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                onBlur={(e) => {
                  setSaveStatus('saving')
                  updateNoteMutation.mutate({ id: activeNote.id, title: e.target.value })
                }}
                aria-label={t('notes.noteTitlePlaceholder')}
                className="flex-1 min-w-0 text-xl font-bold bg-transparent text-[var(--label)] focus:outline-none placeholder:text-[var(--label-3)]"
                placeholder={t('notes.noteTitlePlaceholder')}
              />
              <SaveStatusIndicator status={saveStatus} />
            </div>

            {noteContentQuery.isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Toolbar */}
                {editor && (
                  <div className="px-8 py-2 border-b border-[var(--sep)] flex items-center gap-0.5">
                    <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                      <Bold className="w-3.5 h-3.5" />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                      <Italic className="w-3.5 h-3.5" />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                      <UnderlineIcon className="w-3.5 h-3.5" />
                    </ToolbarButton>
                    <div className="w-px h-4 bg-[var(--sep)] mx-1" />
                    <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                      <Heading1 className="w-3.5 h-3.5" />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                      <Heading2 className="w-3.5 h-3.5" />
                    </ToolbarButton>
                    <div className="w-px h-4 bg-[var(--sep)] mx-1" />
                    <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                      <List className="w-3.5 h-3.5" />
                    </ToolbarButton>
                    <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                      <ListOrdered className="w-3.5 h-3.5" />
                    </ToolbarButton>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-8 py-6">
                  <EditorContent editor={editor} className="prose max-w-none" />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-[var(--label-3)]">{t('notes.emptyState')}</p>
            <button
              onClick={() => createNoteMutation.mutate({ title: t('notes.untitled'), content: '', folderId: null })}
              disabled={createNoteMutation.isPending}
              className="px-4 py-2 rounded-[8px] bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-h)] transition-colors disabled:opacity-50"
            >
              {t('notes.createNote')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 rounded-[6px] transition-colors ${
        active
          ? 'bg-[var(--surface-2)] text-[var(--label)]'
          : 'text-[var(--label-2)] hover:bg-[var(--surface-2)]'
      }`}
    >
      {children}
    </button>
  )
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  const { t } = useTranslation()
  if (status === 'idle') return null

  const configs = {
    unsaved: {
      icon: <Circle className="w-3 h-3" />,
      label: t('common.unsavedChanges'),
      className: 'text-[var(--label-3)]',
    },
    saving: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: t('common.saving'),
      className: 'text-[var(--label-3)]',
    },
    saved: {
      icon: <Check className="w-3 h-3" />,
      label: t('common.saved'),
      className: 'text-[var(--success,#22c55e)]',
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: t('common.failedToSave'),
      className: 'text-[var(--danger,#ef4444)]',
    },
  }

  const { icon, label, className } = configs[status]

  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium shrink-0 transition-opacity duration-300 ${className}`}
    >
      {icon}
      {label}
    </span>
  )
}
