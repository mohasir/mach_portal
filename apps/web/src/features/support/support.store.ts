import { create } from 'zustand';

interface SupportState {
  expandedSlugs: Set<string>;
  toggleCategory: (slug: string) => void;
}

export const useSupportStore = create<SupportState>((set) => ({
  expandedSlugs: new Set(),
  toggleCategory: (slug) =>
    set((state) => {
      const next = new Set(state.expandedSlugs);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return { expandedSlugs: next };
    }),
}));
