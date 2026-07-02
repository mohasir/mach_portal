import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  locale: string;
  setLocale: (locale: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      locale: 'es',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'ui-store' },
  ),
);
