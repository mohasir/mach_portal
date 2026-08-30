import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { notFound } from 'next/navigation';
import { findArticleCategory, HelpArticleView } from '@/features/support';

const CONTENT_DIR = join(process.cwd(), 'src/features/support/content');

function readArticleBody(locale: 'es' | 'en', slug: string) {
  try {
    return readFileSync(join(CONTENT_DIR, locale, `${slug}.md`), 'utf-8');
  } catch {
    return '';
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = findArticleCategory(slug);
  if (!category) notFound();

  const bodyEs = readArticleBody('es', slug);
  const bodyEn = readArticleBody('en', slug);
  if (!bodyEs && !bodyEn) notFound();

  return (
    <HelpArticleView
      articleSlug={slug}
      categoryLabelKey={`categories.${category.slug}.label`}
      bodyEs={bodyEs}
      bodyEn={bodyEn}
    />
  );
}
