import type { LucideIcon } from 'lucide-react';

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
}

export interface HelpCategory {
  slug: string;
  label: string;
  caption: string;
  icon: LucideIcon;
  articles: HelpArticle[];
}
