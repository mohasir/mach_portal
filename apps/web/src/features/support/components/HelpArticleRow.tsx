'use client';
import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { HelpArticle } from '../types';

interface HelpArticleRowProps {
  article: HelpArticle;
  showDescription?: boolean;
}

export function HelpArticleRow({ article, showDescription = true }: HelpArticleRowProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/admin/settings/support/${article.slug}`)}
      className="flex w-full items-start gap-2 py-3.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="text-base">{article.title}</div>
        {showDescription && article.description && (
          <div className="text-muted text-xs">{article.description}</div>
        )}
      </div>
      <ChevronRight size={18} className="text-primary mt-1 shrink-0" />
    </button>
  );
}
