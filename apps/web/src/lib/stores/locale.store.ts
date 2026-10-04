import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocaleState {
  locale: string;
  // Tells a language the user picked apart from the initial default, so only a real choice is
  // ever pushed to the server as their preference.
  chosen: boolean;
  setLocale: (locale: string) => void;
}

const DEFAULT_LOCALE = 'es';

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      chosen: false,
      setLocale: (locale) => set({ locale, chosen: true }),
    }),
    {
      name: 'locale',
      version: 1,
      // v0 had no `chosen`: a stored non-default language can only have come from the user.
      migrate: (persisted, version) => {
        const state = persisted as Partial<LocaleState>;
        return version === 0 ? { ...state, chosen: state.locale !== DEFAULT_LOCALE } : state;
      },
    },
  ),
);
