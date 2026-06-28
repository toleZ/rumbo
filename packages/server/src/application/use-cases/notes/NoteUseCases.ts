import { NotFoundError } from '../../../domain/errors.js'
import type { INoteRepository, CreateNoteInput, UpdateNoteInput, NoteRecord, NoteSummary } from '../../../domain/repositories/INoteRepository.js'

export class ListNotesUseCase {
  private readonly notes: INoteRepository

  constructor(notes: INoteRepository) {
    this.notes = notes
  }

  execute(userId: string): Promise<NoteSummary[]> {
    return this.notes.listByUser(userId)
  }
}

export class GetNoteUseCase {
  private readonly notes: INoteRepository

  constructor(notes: INoteRepository) {
    this.notes = notes
  }

  async execute(userId: string, id: string): Promise<NoteRecord> {
    const note = await this.notes.findById(id)
    if (!note || note.userId !== userId) {
      throw new NotFoundError('Note not found')
    }
    return note
  }
}

export class CreateNoteUseCase {
  private readonly notes: INoteRepository

  constructor(notes: INoteRepository) {
    this.notes = notes
  }

  execute(userId: string, data: CreateNoteInput): Promise<NoteRecord> {
    return this.notes.create(userId, data)
  }
}

export class UpdateNoteUseCase {
  private readonly notes: INoteRepository

  constructor(notes: INoteRepository) {
    this.notes = notes
  }

  async execute(userId: string, id: string, data: UpdateNoteInput): Promise<NoteRecord> {
    const note = await this.notes.findById(id)
    if (!note || note.userId !== userId) {
      throw new NotFoundError('Note not found')
    }
    return this.notes.update(id, data)
  }
}

export class DeleteNoteUseCase {
  private readonly notes: INoteRepository

  constructor(notes: INoteRepository) {
    this.notes = notes
  }

  async execute(userId: string, id: string): Promise<void> {
    const note = await this.notes.findById(id)
    if (!note || note.userId !== userId) {
      throw new NotFoundError('Note not found')
    }
    await this.notes.delete(id)
  }
}

export class ReorderNotesUseCase {
  private readonly notes: INoteRepository

  constructor(notes: INoteRepository) {
    this.notes = notes
  }

  async execute(userId: string, noteIds: string[], folderId: string | null): Promise<void> {
    const found = await Promise.all(noteIds.map((id) => this.notes.findById(id)))
    if (found.some((n) => !n || n.userId !== userId || n.folderId !== folderId)) {
      throw new NotFoundError('Some notes not found or not in the expected folder')
    }
    await this.notes.reorder(noteIds, folderId)
  }
}
