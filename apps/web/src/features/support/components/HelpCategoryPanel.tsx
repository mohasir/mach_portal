'use client';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { IconBadge } from '@/components/shared/IconBadge';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { HelpArticleRow } from './HelpArticleRow';
import { useSupportStore } from '../support.store';
import type { HelpCategory } from '../types';

interface HelpCategoryPanelProps {
  category: HelpCategory;
}

export function HelpCategoryPanel({ category }: HelpCategoryPanelProps) {
  const expanded = useSupportStore((s) => s.expandedSlugs.has(category.slug));
  const toggleCategory = useSupportStore((s) => s.toggleCategory);

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleCategory(category.slug)}
        className="flex w-full min-w-0 items-center gap-2 text-left"
      >
        <IconBadge icon={category.icon} shape="square" className="bg-primary/8 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium">{category.label}</div>
          {category.caption && <div className="text-muted text-xs">{category.caption}</div>}
        </div>
        {expanded ? (
          <ChevronDown size={20} className="text-primary shrink-0" />
        ) : (
          <ChevronRight size={20} className="text-primary shrink-0" />
        )}
      </button>

      {expanded && (
        <WrapperCard variant="outlined" className="mt-2 bg-primary/5">
          <div className="divide-line flex flex-col divide-y">
            {category.articles.map((article) => (
              <HelpArticleRow key={article.slug} article={article} />
            ))}
          </div>
        </WrapperCard>
      )}
    </div>
  );
}
