'use client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveVocabulary, type CatalogVocabulary } from '../vocabulary';
import { useTenantProfile } from './useTenantProfile';

/**
 * The words for what the organization sells, to interpolate into texts as `{{item}}`, `{{items}}`,
 * `{{Item}}` and `{{Items}}`: `t('key', vocabulary)`. Neutral words until the profile loads.
 */
export function useCatalogVocabulary(): CatalogVocabulary {
  const { t } = useTranslation('vocabulary');
  const { catalogKind, isPending } = useTenantProfile();

  // react-i18next returns a new `t` when the language changes, which refreshes the words.
  return useMemo(
    () => resolveVocabulary(isPending ? undefined : catalogKind, t),
    [catalogKind, isPending, t],
  );
}
