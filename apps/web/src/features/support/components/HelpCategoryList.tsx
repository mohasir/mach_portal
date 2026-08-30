'use client';
import { Fragment, useMemo, useState } from 'react';
import { Divider, Empty, Input, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useHelpCategories } from '../hooks/useHelpCategories';
import { HelpArticleRow } from './HelpArticleRow';
import { HelpCategoryPanel } from './HelpCategoryPanel';

export function HelpCategoryList() {
  const { t } = useTranslation('support');
  const categories = useHelpCategories();
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;

  const results = useMemo(() => {
    if (!isSearching) return [];
    return categories
      .map((category) => ({
        ...category,
        articles: category.articles.filter((article) =>
          article.title.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((category) => category.articles.length > 0);
  }, [categories, isSearching, normalizedQuery]);

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <Typography.Title level={3} className="font-heading text-brown m-0!">
          {t('hero.title')}
        </Typography.Title>
        <Input.Search
          allowClear
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('hero.searchPlaceholder')}
          className="w-full max-w-md"
        />
      </div>

      {isSearching ? (
        results.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('hero.noResults')} />
        ) : (
          <div className="flex flex-col gap-6">
            {results.map((category) => (
              <div key={category.slug}>
                <Typography.Text type="secondary" className="text-xs">
                  {category.label}
                </Typography.Text>
                <div className="divide-line flex flex-col divide-y">
                  {category.articles.map((article) => (
                    <HelpArticleRow key={article.slug} article={article} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col">
          {categories.map((category, index) => (
            <Fragment key={category.slug}>
              {index > 0 && <Divider className="my-4" />}
              <HelpCategoryPanel category={category} />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
