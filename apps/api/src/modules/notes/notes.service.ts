import { TRPCError } from '@trpc/server';
import { NotesRepository } from './notes.repository';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { CreateNoteInput, UpdateNoteInput } from '@repo/schemas';

export class NotesService {
  constructor(private repo: NotesRepository) {}

  list(userId: string) {
    return this.repo.findAllByUser(userId);
  }

  async create(userId: string, input: CreateNoteInput) {
    const note = await this.repo.create({ ...input, userId });
    if (!note) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return note;
  }

  async update(id: string, userId: string, input: UpdateNoteInput) {
    const note = await this.repo.update(id, userId, input);
    if (!note) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.NOTE_NOT_FOUND) });
    return note;
  }

  async delete(id: string, userId: string) {
    const note = await this.repo.delete(id, userId);
    if (!note) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.NOTE_NOT_FOUND) });
    return note;
  }
}
