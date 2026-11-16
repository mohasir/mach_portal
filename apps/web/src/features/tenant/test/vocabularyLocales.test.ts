import { describe, expect, it } from 'vitest';
import { CATALOG_KINDS } from '@repo/schemas';
import enVocabulary from '@/locales/en/vocabulary.json';
import esVocabulary from '@/locales/es/vocabulary.json';
import enAdmin from '@/locales/en/admin.json';
import enApi from '@/locales/en/api.json';
import enCatalog from '@/locales/en/catalog.json';
import enProductCategories from '@/locales/en/productCategories.json';
import enDashboard from '@/locales/en/dashboard.json';
import enEvents from '@/locales/en/events.json';
import enQuotes from '@/locales/en/quotes.json';
import enRoles from '@/locales/en/roles.json';
import enSettings from '@/locales/en/settings.json';
import enSupport from '@/locales/en/support.json';
import esAdmin from '@/locales/es/admin.json';
import esApi from '@/locales/es/api.json';
import esCatalog from '@/locales/es/catalog.json';
import esProductCategories from '@/locales/es/productCategories.json';
import esDashboard from '@/locales/es/dashboard.json';
import esEvents from '@/locales/es/events.json';
import esQuotes from '@/locales/es/quotes.json';
import esRoles from '@/locales/es/roles.json';
import esSettings from '@/locales/es/settings.json';
import esSupport from '@/locales/es/support.json';
import { resolveVocabulary } from '../vocabulary';

type Tree = { [key: string]: string | Tree };

const NAMESPACES: Record<string, { es: Tree; en: Tree }> = {
  admin: { es: esAdmin, en: enAdmin },
  api: { es: esApi, en: enApi },
  catalog: { es: esCatalog, en: enCatalog },
  dashboard: { es: esDashboard, en: enDashboard },
  events: { es: esEvents, en: enEvents },
  productCategories: { es: esProductCategories, en: enProductCategories },
  quotes: { es: esQuotes, en: enQuotes },
  roles: { es: esRoles, en: enRoles },
  settings: { es: esSettings, en: enSettings },
  support: { es: esSupport, en: enSupport },
};

const PLACEHOLDER = /\{\{(item|items|Item|Items)\}\}/g;
// Not global: a global regex keeps `lastIndex` between `test` calls.
const hasPlaceholder = (value: string) => /\{\{(item|items|Item|Items)\}\}/.test(value);

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') out.set(`${prefix}${key}`, value);
    else for (const [k, v] of flatten(value, `${prefix}${key}.`)) out.set(k, v);
  }
  return out;
}

const dictionaries = { es: esVocabulary, en: enVocabulary } as const;
const lookup =
  (lang: 'es' | 'en') =>
  (key: string): string => {
    const [group, form] = key.split('.') as [keyof typeof esVocabulary, string];
    return (dictionaries[lang][group] as Record<string, string>)[form]!;
  };

describe.each(Object.entries(NAMESPACES))(
  '%s locale vocabulary placeholders',
  (_ns, { es, en }) => {
    const esFlat = flatten(es);
    const enFlat = flatten(en);

    it('carry a placeholder in both languages or in neither', () => {
      const mismatched = [...esFlat.keys()]
        .filter((key) => enFlat.has(key))
        .filter((key) => hasPlaceholder(esFlat.get(key)!) !== hasPlaceholder(enFlat.get(key)!));
      expect(mismatched).toEqual([]);
    });

    it.each(CATALOG_KINDS)('resolve fully and without the client noun for %s', (kind) => {
      for (const lang of ['es', 'en'] as const) {
        const vocabulary = resolveVocabulary(kind, lookup(lang));
        for (const [key, value] of flatten(lang === 'es' ? es : en)) {
          const resolved = value.replace(
            PLACEHOLDER,
            (_m, form: keyof typeof vocabulary) => vocabulary[form],
          );
          expect(resolved, `${lang}:${key}`).not.toMatch(/\{\{\s*(item|items|Item|Items)\s*\}\}/);
          expect(resolved, `${lang}:${key}`).not.toMatch(/estaci|station/i);
        }
      }
    });
  },
);
