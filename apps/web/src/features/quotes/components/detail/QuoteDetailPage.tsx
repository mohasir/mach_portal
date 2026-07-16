'use client';
import { Card, Skeleton } from 'antd';
import { useProductCatalog } from '@/features/catalog';
import { useQuote } from '../../hooks/useQuotes';
import { QuoteHistoryCard } from '../builder/QuoteHistoryCard';
import { QuoteDetailCard } from './QuoteDetailCard';
import { QuoteIncludedServicesCard } from './QuoteIncludedServicesCard';

interface QuoteDetailPageProps {
  quoteId: string;
}

export function QuoteDetailPage({ quoteId }: QuoteDetailPageProps) {
  const { data: detail, isLoading: quoteLoading } = useQuote(quoteId);
  const { data: catalog, isLoading: catalogLoading } = useProductCatalog();

  if (quoteLoading || catalogLoading || !detail || !catalog) {
    return <Skeleton active paragraph={{ rows: 12 }} />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="min-h-[calc(100vh-88px)]" classNames={{ body: 'flex h-full flex-col' }}>
        <QuoteDetailCard detail={detail} catalog={catalog} />
      </Card>
      <div className="flex flex-col gap-6 self-start">
        <Card>
          <QuoteIncludedServicesCard detail={detail} catalog={catalog} />
        </Card>
        <Card>
          <QuoteHistoryCard
            createdByName={detail.createdByName}
            createdAt={detail.createdAt}
            stageHistory={detail.stageHistory}
          />
        </Card>
      </div>
    </div>
  );
}
