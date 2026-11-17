import type { CatalogVocabulary } from '@/features/tenant/vocabulary';

/** Articles are static markdown: their `{{item}}`-style marks are filled before rendering. */
export function fillVocabulary(text: string, vocabulary: CatalogVocabulary): string {
  return text.replace(
    /\{\{(item|items|Item|Items)\}\}/g,
    (_, form: keyof CatalogVocabulary) => vocabulary[form],
  );
}
