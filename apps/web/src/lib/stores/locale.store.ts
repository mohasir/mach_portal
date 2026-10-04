import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localeSchema, type AppLocale } from '@repo/schemas';

interface LocaleState {
  locale: AppLocale;
  // Tells a language the user picked apart from the initial default, so only a real choice is
  // ever pushed to the server as their preference.
  chosen: boolean;
  setLocale: (locale: AppLocale) => void;
}

const DEFAULT_LOCALE: AppLocale = 'es';

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
      // v0 had no `chosen` and typed the locale as any string: an unknown one falls back to the
      // default, and a stored non-default language can only have come from the user.
      migrate: (persisted, version) => {
        const state = persisted as { locale?: string; chosen?: boolean };
        if (version !== 0) return state as LocaleState;
        const locale = localeSchema.catch(DEFAULT_LOCALE).parse(state.locale);
        return { ...state, locale, chosen: locale !== DEFAULT_LOCALE } as LocaleState;
      },
    },
  ),
);
