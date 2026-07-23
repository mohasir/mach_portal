import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type QuotesViewTab = 'pipeline' | 'table';

interface QuotesViewState {
  activeTab: QuotesViewTab;
  setActiveTab: (tab: QuotesViewTab) => void;
}

export const useQuotesViewStore = create<QuotesViewState>()(
  persist(
    (set) => ({
      activeTab: 'pipeline',
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    { name: 'quotes-view' },
  ),
);
