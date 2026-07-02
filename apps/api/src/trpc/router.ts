import { router } from './trpc';
import { notesRouter } from '../modules/notes/notes.router';

export const appRouter = router({
  notes: notesRouter,
});

export type AppRouter = typeof appRouter;
