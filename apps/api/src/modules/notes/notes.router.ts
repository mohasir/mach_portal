import { router, protectedProcedure, guardedProcedure } from '../../trpc/trpc';
import { createNoteSchema, updateNoteSchema } from '@repo/schemas';
import { z } from 'zod';
import { db } from '../../db';
import { NotesRepository } from './notes.repository';
import { NotesService } from './notes.service';

const service = new NotesService(new NotesRepository(db));

export const notesRouter = router({
  // Lectura: cualquier usuario autenticado ve sus propias notas.
  list: protectedProcedure.query(({ ctx }) => service.list(ctx.user.id)),

  // Escrituras: gateadas por permiso del catálogo @repo/auth.
  create: guardedProcedure({ note: ['create'] })
    .input(createNoteSchema)
    .mutation(({ ctx, input }) => service.create(ctx.user.id, input)),

  update: guardedProcedure({ note: ['update'] })
    .input(z.object({ id: z.string(), data: updateNoteSchema }))
    .mutation(({ ctx, input }) => service.update(input.id, ctx.user.id, input.data)),

  delete: guardedProcedure({ note: ['delete'] })
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => service.delete(input.id, ctx.user.id)),
});
