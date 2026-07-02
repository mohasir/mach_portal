import { z } from 'zod';

export const createNoteSchema = z.object({
  title: z.string().min(1, 'notes.validation.titleRequired').max(120),
  content: z.string().max(5000).optional(),
});

export const updateNoteSchema = createNoteSchema.partial();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
