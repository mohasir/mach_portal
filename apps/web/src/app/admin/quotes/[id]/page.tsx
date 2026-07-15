import { QuoteBuilderPage } from '@/features/quotes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <QuoteBuilderPage quoteId={id} />;
}
