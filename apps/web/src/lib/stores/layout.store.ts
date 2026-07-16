import { create } from 'zustand';

interface LayoutState {
  fillViewport: boolean;
  setFillViewport: (fillViewport: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  fillViewport: false,
  setFillViewport: (fillViewport) => set({ fillViewport }),
}));
