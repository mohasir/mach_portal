'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Card, Skeleton, Tooltip, Typography } from 'antd';
import { Copy, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE } from '@repo/schemas';
import { useProductCatalog } from '@/features/catalog';
import { PageHeader } from '@/components/shared/PageHeader';
import { ShareButton } from '@/components/shared/ShareButton';
import { isAfter } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { useGenerateQuotePdf, useQuote } from '../../hooks/useQuotes';
import { QuoteHistoryCard } from '../builder/QuoteHistoryCard';
import { QuoteDetailCard } from './QuoteDetailCard';
import { QuoteIncludedServicesCard } from './QuoteIncludedServicesCard';

interface QuoteDetailPageProps {
  quoteId: string;
}

export function QuoteDetailPage({ quoteId }: QuoteDetailPageProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { dateTime } = useDateFormatter();
  const { data: detail, isLoading: quoteLoading } = useQuote(quoteId);
  const { data: catalog, isLoading: catalogLoading } = useProductCatalog();
  const { generatePdf, isPending: isGeneratingPdf } = useGenerateQuotePdf();
  const setContentBg = useLayoutStore((s) => s.setContentBg);

  useEffect(() => {
    setContentBg('grey');
    return () => setContentBg('white');
  }, [setContentBg]);

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

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) message.success(tc('share.linkCopied'));
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={detail.number}
        titleSuffix={
          <Tooltip title={tc('share.copyLink')}>
            <Button
              type="text"
              size="small"
              icon={<Copy size={16} />}
              onClick={() => void handleCopyLink()}
            />
          </Tooltip>
        }
        onBack={onBack}
        actions={
          isDesktop &&
          showPdfAction && (
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  type="primary"
                  icon={<Download size={16} />}
                  loading={isGeneratingPdf}
                  className="w-full sm:w-auto"
                  onClick={handleClick}
                >
                  {t('detail.generatePdf')}
                </Button>
                {hasPdf && <ShareButton url={detail.pdfUrl!} title={detail.number} />}
              </div>
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
