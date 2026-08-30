'use client';
import { type ReactNode, isValidElement, useMemo } from 'react';
import { Typography } from 'antd';
import { ChevronRight, Info } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { findArticle } from '../content/categories';
import { useHelpCategories } from '../hooks/useHelpCategories';
import { HelpArticleRow } from './HelpArticleRow';

const MAX_RELATED_ARTICLES = 5;

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) return textContent((node.props as { children?: ReactNode }).children);
  return '';
}

interface HelpArticleViewProps {
  articleSlug: string;
  categoryLabelKey: string;
  bodyEs: string;
  bodyEn: string;
}

export function HelpArticleView({
  articleSlug,
  categoryLabelKey,
  bodyEs,
  bodyEn,
}: HelpArticleViewProps) {
  const { t, i18n } = useTranslation('support');
  const { date } = useDateFormatter();
  const body = i18n.language === 'en' && bodyEn ? bodyEn : bodyEs;
  const headings = useMemo(
    () =>
      [...body.matchAll(/^## (.+)$/gm)].map((m) => {
        const text = m[1]!.trim();
        return { text, id: slugify(text) };
      }),
    [body],
  );
  const updatedAt = findArticle(articleSlug)?.updatedAt;
  const categories = useHelpCategories();
  const relatedArticles = (
    categories.find((c) => c.articles.some((a) => a.slug === articleSlug))?.articles ?? []
  )
    .filter((a) => a.slug !== articleSlug)
    .slice(0, MAX_RELATED_ARTICLES);

  return (
    <div className="flex flex-col gap-4 px-2">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-1">
            <span className="whitespace-nowrap">{t('title')}</span>
            <ChevronRight size={20} className="text-muted shrink-0" />
            <span className="text-muted font-sans text-base font-normal whitespace-nowrap">
              {t(categoryLabelKey)}
            </span>
          </span>
        }
        backHref="/admin/settings/support"
      />
      <div className="flex flex-col gap-1">
        <Typography.Title level={1} className="text-black text-2xl! m-0!">
          {t(`articles.${articleSlug}.title`)}
        </Typography.Title>
        <Typography.Text type="secondary" className="text-base">
          {t(`articles.${articleSlug}.description`)}
        </Typography.Text>
        {updatedAt && (
          <Typography.Text className="text-muted text-xs mt-2">
            {t('lastUpdated', { date: date(updatedAt) })}
          </Typography.Text>
        )}
        <div className="border-line-strong mt-3 border-t" />
      </div>
      {headings.length > 1 && (
        <WrapperCard variant="outlined" className="bg-primary/5">
          <div className="text-muted mb-2 text-xs font-semibold">{t('tableOfContents')}</div>
          <ul className="flex flex-col gap-1.5">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a href={`#${heading.id}`} className="text-primary text-sm underline">
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </WrapperCard>
      )}
      <div className="text-black text-base [&_h2]:text-black flex flex-col gap-3 [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-primary [&_ul]:marker:text-xl [&_ol]:list-decimal [&_ol]:pl-5 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-line [&_pre]:bg-primary/5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:whitespace-pre-wrap [&_pre]:wrap-break-word [&_code]:bg-primary/5 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_th]:border-line [&_th]:border [&_th]:bg-primary/5 [&_th]:p-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-medium [&_td]:border-line [&_td]:border [&_td]:p-2 [&_td]:align-top [&_td]:text-sm [&_thead_tr>*]:border-t-0 [&_tbody_tr:last-child>*]:border-b-0 [&_tr>*:first-child]:border-l-0 [&_tr>*:last-child]:border-r-0">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => (
              <div className="mt-4">
                <h2 id={slugify(textContent(children))} className="scroll-mt-20">
                  {children}
                </h2>
                <div className="border-line-strong my-1 border-t" />
              </div>
            ),
            table: ({ children }) => (
              <div className="border-line overflow-hidden rounded-lg border">
                <div className="overflow-x-auto">
                  <table>{children}</table>
                </div>
              </div>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-primary bg-primary/5 rounded-r-lg border-l-4 py-3 px-4">
                <div className="text-primary mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <Info size={16} />
                  {t('note')}
                </div>
                <div className="text-sm [&_p]:m-0">{children}</div>
              </blockquote>
            ),
            a: ({ href, children }) =>
              href?.startsWith('/') ? (
                <Link href={href} className="text-primary underline">
                  {children}
                </Link>
              ) : (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {children}
                </a>
              ),
          }}
        >
          {body}
        </ReactMarkdown>
      </div>

      {relatedArticles.length > 0 && (
        <div className="mt-4 pb-10">
          <div className="border-line-strong mb-8 border-t-2" />
          <h2 className="text-black mt-2 text-xl font-bold">{t('relatedArticles')}</h2>
          <WrapperCard variant="outlined" className="mt-2 bg-primary/5">
            <div className="divide-line flex flex-col divide-y">
              {relatedArticles.map((article) => (
                <HelpArticleRow key={article.slug} article={article} showDescription={false} />
              ))}
            </div>
          </WrapperCard>
        </div>
      )}
    </div>
  );
}
