import { create } from 'zustand';
import type { QuoteStageId } from '@repo/schemas';

interface PipelineScrollState {
  columnScrollTop: Partial<Record<QuoteStageId, number>>;
  setColumnScrollTop: (stageId: QuoteStageId, top: number) => void;
  mobileScrollLeft: number;
  setMobileScrollLeft: (left: number) => void;
}

/** In-memory only (no persist): survives a client-side route push/back to the board, resets on a hard reload. */
export const usePipelineScrollStore = create<PipelineScrollState>((set) => ({
  columnScrollTop: {},
  setColumnScrollTop: (stageId, top) =>
    set((state) => ({ columnScrollTop: { ...state.columnScrollTop, [stageId]: top } })),
  mobileScrollLeft: 0,
  setMobileScrollLeft: (mobileScrollLeft) => set({ mobileScrollLeft }),
}));
