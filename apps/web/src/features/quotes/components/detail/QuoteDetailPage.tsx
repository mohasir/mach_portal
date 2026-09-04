'use client';
import { Card, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE } from '@repo/schemas';
import { useProductCatalog } from '@/features/catalog';
import { PageHeader } from '@/components/shared/PageHeader';
import { isAfter } from '@/lib/date';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useGenerateQuotePdf, useQuote } from '../../hooks/useQuotes';
import { QuoteHistoryCard } from '../builder/QuoteHistoryCard';
import { QuoteDetailCard } from './QuoteDetailCard';
import { QuoteIncludedServicesCard } from './QuoteIncludedServicesCard';

interface QuoteDetailPageProps {
  quoteId: string;
}

export function QuoteDetailPage({ quoteId }: QuoteDetailPageProps) {
  const { t } = useTranslation('quotes');
  const isDesktop = useIsDesktop();
  const { data: detail, isLoading: quoteLoading } = useQuote(quoteId);
  const { data: catalog, isLoading: catalogLoading } = useProductCatalog();
  const { generatePdf, isPending: isGeneratingPdf } = useGenerateQuotePdf();

  if (quoteLoading || catalogLoading || !detail || !catalog) {
    return (
      <div>
        <PageHeader title={t('detail.title')} titleSize="sm" onBack />
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    );
  }

  const hasPdf = Boolean(detail.pdfUrl);

  const canGeneratePdf =
    !detail.isDraft ||
    detail.stageId === QUOTE_STAGE.QUOTED ||
    detail.stageId === QUOTE_STAGE.CONFIRMED;
  const isStale = hasPdf && isAfter(detail.updatedAt, detail.pdfGeneratedAt!);

  const handleClick = () => {
    if (hasPdf && !isStale) {
      window.open(detail.pdfUrl!, '_blank');
      return;
    }
    void generatePdf(quoteId);
  };

  const showPdfAction = hasPdf || canGeneratePdf;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('detail.title')} titleSize="sm" onBack />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {isDesktop ? (
          <Card className="min-h-[calc(100vh-88px)]" classNames={{ body: 'flex h-full flex-col' }}>
            <QuoteDetailCard
              detail={detail}
              catalog={catalog}
              onGeneratePdf={handleClick}
              isGeneratingPdf={isGeneratingPdf}
              showPdfAction={showPdfAction}
            />
          </Card>
        ) : (
          <QuoteDetailCard
            detail={detail}
            catalog={catalog}
            onGeneratePdf={handleClick}
            isGeneratingPdf={isGeneratingPdf}
            showPdfAction={showPdfAction}
          />
        )}
        <div className="flex flex-col gap-6 self-start">
          <QuoteIncludedServicesCard detail={detail} catalog={catalog} />
          <QuoteHistoryCard
            createdByName={detail.createdByName}
            createdAt={detail.createdAt}
            stageHistory={detail.stageHistory}
            assignmentHistory={detail.assignmentHistory}
          />
        </div>
      </div>
    </div>
  );
}
