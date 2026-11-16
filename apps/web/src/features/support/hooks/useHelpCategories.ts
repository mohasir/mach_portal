import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { useCan } from '@/lib/auth/useCan';
import { HELP_CATEGORIES } from '../content/categories';
import type { HelpCategory } from '../types';

export function useHelpCategories(): HelpCategory[] {
  const { t } = useTranslation('support');
  const can = useCan();
  const vocabulary = useCatalogVocabulary();

  return HELP_CATEGORIES.map((category) => ({
    slug: category.slug,
    label: t(`categories.${category.slug}.label`),
    caption: t(`categories.${category.slug}.caption`, vocabulary),
    icon: category.icon,
    articles: category.articles
      .filter((article) => !article.guard || can(article.guard))
      .map(({ slug }) => ({
        slug,
        title: t(`articles.${slug}.title`, vocabulary),
        description: t(`articles.${slug}.description`, vocabulary),
      })),
  })).filter((category) => category.articles.length > 0);
}
