import { create } from 'zustand'
import type { Note, Folder } from '../types'

const generateId = () => crypto.randomUUID()

interface NoteState {
  notes: Note[]
  folders: Folder[]
  activeNoteId: string | null
  isHydrated: boolean
  hydrate: (data: { notes: Note[]; folders: Folder[] }) => void
  addNote: (folderId?: string | null) => string
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
  setActiveNote: (id: string | null) => void
  moveNoteToFolder: (noteId: string, folderId: string | null) => void
  reorderNotes: (noteIds: string[], folderId: string | null) => void
  addFolder: (name: string, parentId?: string | null) => void
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  reorderFolders: (folderIds: string[], parentId: string | null) => void
  reset: () => void
}

export const useNoteStore = create<NoteState>((set) => ({
  notes: [],
  folders: [],
  activeNoteId: null,
  isHydrated: false,

  // Wipe all per-user data — called on login/logout to prevent cross-user bleed.
  reset: () => set({ notes: [], folders: [], activeNoteId: null, isHydrated: false }),

  hydrate: ({ notes, folders }) => set({ notes, folders, isHydrated: true }),

  addNote: (folderId = null) => {
    const id = generateId()
    const now = new Date().toISOString()
    const newNote: Note = { id, title: 'Untitled', content: '', folderId: folderId ?? null, order: 0, createdAt: now, updatedAt: now }
    set((state) => ({ notes: [newNote, ...state.notes], activeNoteId: id }))
    return id
  },

  updateNote: (id, updates) =>
    set((state) => ({
      notes: state.notes.map((n) => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n),
    })),

  deleteNote: (id) =>
    set((state) => {
      const filtered = state.notes.filter((n) => n.id !== id)
      return {
        notes: filtered,
        activeNoteId: state.activeNoteId === id ? (filtered.length > 0 ? filtered[0].id : null) : state.activeNoteId,
      }
    }),

  setActiveNote: (id) => set({ activeNoteId: id }),

  moveNoteToFolder: (noteId, folderId) =>
    set((state) => ({
      notes: state.notes.map((n) => n.id === noteId ? { ...n, folderId, updatedAt: new Date().toISOString() } : n),
    })),

  reorderNotes: (noteIds) =>
    set((state) => ({
      notes: state.notes.map((n) => {
        const idx = noteIds.indexOf(n.id)
        return idx !== -1 ? { ...n, order: idx } : n
      }),
    })),

  addFolder: (name, parentId = null) =>
    set((state) => {
      const siblingsCount = state.folders.filter((f) => f.parentId === (parentId ?? null)).length
      return { folders: [...state.folders, { id: generateId(), name, parentId: parentId ?? null, order: siblingsCount }] }
    }),

  renameFolder: (id, name) => set((state) => ({ folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),

  reorderFolders: (folderIds) =>
    set((state) => ({
      folders: state.folders.map((f) => {
        const idx = folderIds.indexOf(f.id)
        return idx !== -1 ? { ...f, order: idx } : f
      }),
    })),

  deleteFolder: (id) =>
    set((state) => {
      const getDescendantIds = (folderId: string): string[] => {
        const children = state.folders.filter((f) => f.parentId === folderId)
        return [folderId, ...children.flatMap((c) => getDescendantIds(c.id))]
      }
      const idsToDelete = getDescendantIds(id)
      return {
        folders: state.folders.filter((f) => !idsToDelete.includes(f.id)),
        notes: state.notes.map((n) => n.folderId && idsToDelete.includes(n.folderId) ? { ...n, folderId: null } : n),
      }
    }),
}))
