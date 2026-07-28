import { create } from 'zustand';

type ContentBg = 'white' | 'grey';

interface LayoutState {
  fillViewport: boolean;
  setFillViewport: (fillViewport: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  contentBg: ContentBg;
  setContentBg: (contentBg: ContentBg) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  fillViewport: false,
  setFillViewport: (fillViewport) => set({ fillViewport }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  contentBg: 'white',
  setContentBg: (contentBg) => set({ contentBg }),
}));
