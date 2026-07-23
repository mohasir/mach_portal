'use client';
import { useRouter } from 'next/navigation';
import { Button, Card, Skeleton, Typography } from 'antd';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE } from '@repo/schemas';
import { useProductCatalog } from '@/features/catalog';
import { PageHeader } from '@/components/shared/PageHeader';
import { isAfter } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
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
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { dateTime } = useDateFormatter();
  const { data: detail, isLoading: quoteLoading } = useQuote(quoteId);
  const { data: catalog, isLoading: catalogLoading } = useProductCatalog();
  const { generatePdf, isPending: isGeneratingPdf } = useGenerateQuotePdf();

  const onBack = () => router.back();

  if (quoteLoading || catalogLoading || !detail || !catalog) {
    return (
      <div>
        <PageHeader title={t('detail.title')} onBack={onBack} />
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    );
  }

  const hasPdf = Boolean(detail.pdfUrl);
  const canGeneratePdf =
    detail.stageId === QUOTE_STAGE.QUOTED || detail.stageId === QUOTE_STAGE.CONFIRMED;
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
      <PageHeader
        title={detail.number}
        onBack={onBack}
        actions={
          isDesktop &&
          showPdfAction && (
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="primary"
                icon={<Download size={16} />}
                loading={isGeneratingPdf}
                className="w-full sm:w-auto"
                onClick={handleClick}
              >
                {t('detail.generatePdf')}
              </Button>
              {detail.pdfGeneratedAt && (
                <Typography.Text type="secondary" className="text-xs">
                  {t('detail.pdfGeneratedAt', { date: dateTime(detail.pdfGeneratedAt) })}
                </Typography.Text>
              )}
            </div>
          )
        }
      />

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
    </div>
  );
}
