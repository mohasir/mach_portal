import { create } from 'zustand';
import type { PipelineColumnKey } from './types';

interface PipelineScrollState {
  columnScrollTop: Partial<Record<PipelineColumnKey, number>>;
  setColumnScrollTop: (column: PipelineColumnKey, top: number) => void;
  mobileScrollLeft: number;
  setMobileScrollLeft: (left: number) => void;
}

/** In-memory only (no persist): survives a client-side route push/back to the board, resets on a hard reload. */
export const usePipelineScrollStore = create<PipelineScrollState>((set) => ({
  columnScrollTop: {},
  setColumnScrollTop: (column, top) =>
    set((state) => ({ columnScrollTop: { ...state.columnScrollTop, [column]: top } })),
  mobileScrollLeft: 0,
  setMobileScrollLeft: (mobileScrollLeft) => set({ mobileScrollLeft }),
}));
