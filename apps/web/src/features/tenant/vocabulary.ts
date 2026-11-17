import type { CatalogKind } from '@repo/schemas';

export const VOCABULARY_FORMS = ['item', 'items', 'Item', 'Items'] as const;
export type VocabularyForm = (typeof VOCABULARY_FORMS)[number];
export type CatalogVocabulary = Record<VocabularyForm, string>;

// Words used while the kind is not known yet (the profile is loading), and the group a future
// mixed catalog would use.
export const NEUTRAL_VOCABULARY_KEY = 'neutral';

/** Resolves the words of a catalog kind through a `vocabulary` namespace translator. */
export function resolveVocabulary(
  kind: CatalogKind | undefined,
  t: (key: string) => string,
): CatalogVocabulary {
  const group = kind ?? NEUTRAL_VOCABULARY_KEY;
  return {
    item: t(`${group}.item`),
    items: t(`${group}.items`),
    Item: t(`${group}.Item`),
    Items: t(`${group}.Items`),
  };
}
