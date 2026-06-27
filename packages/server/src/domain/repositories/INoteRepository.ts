import type { Note } from '@rumbo/shared'

export type NoteRecord = Note & { userId: string }
export type NoteSummary = Omit<Note, 'content'> & { userId: string }

export interface CreateNoteInput {
  title?: string
  content?: string
  folderId?: string | null
}

export interface UpdateNoteInput {
  title?: string
  content?: string
  folderId?: string | null
  order?: number
}

export interface INoteRepository {
  listByUser(userId: string): Promise<NoteSummary[]>
  findById(id: string): Promise<NoteRecord | null>
  create(userId: string, data: CreateNoteInput): Promise<NoteRecord>
  update(id: string, data: UpdateNoteInput): Promise<NoteRecord>
  delete(id: string): Promise<void>
  reorder(noteIds: string[], folderId: string | null): Promise<void>
}
