'use client';
import { App, Button, Card, Descriptions, Divider, Typography } from 'antd';
import { AlertCircle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import { AddressLines } from '@/components/shared/AddressLines';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { IconTag } from '@/components/shared/IconTag';
import { QuoteNumberHeader } from '@/components/shared/QuoteNumberHeader';
import { ShareButton } from '@/components/shared/ShareButton';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { copyToClipboard } from '@/lib/utils/clipboard';
import type { QuoteDetail } from '../../types';
import { QuoteStageTagDropdown } from '../QuoteStageTagDropdown';
import { QuoteSummary } from '../QuoteSummary';
import { QuoteClientCard } from './QuoteClientCard';
import { QuoteLinesCard } from './QuoteLinesCard';
import { IconBadge } from '@/components/shared/IconBadge';

interface QuoteDetailCardProps {
  detail: QuoteDetail;
  catalog: Product[];
  onGeneratePdf?: () => void;
  isGeneratingPdf?: boolean;
  showPdfAction?: boolean;
}

export function QuoteDetailCard({
  detail,
  catalog,
  onGeneratePdf,
  isGeneratingPdf,
  showPdfAction,
}: QuoteDetailCardProps) {
  const { t } = useTranslation('quotes');
  const { message } = App.useApp();
  const { date, dateTime } = useDateFormatter();
  const isDesktop = useIsDesktop();
  const hasPdf = Boolean(detail.pdfUrl);

  const handleCopyNumber = async () => {
    const ok = await copyToClipboard(detail.number);
    if (ok) message.success(t('pipeline.numberCopied'));
  };

  const eventDateTime = detail.eventDate
    ? `${date(detail.eventDate)}${detail.eventTime ? `, ${detail.eventTime}` : ''}`
    : (detail.eventTime ?? '—');

  const isPastDue =
    (detail.stageId === QUOTE_STAGE.PENDING || detail.stageId === QUOTE_STAGE.QUOTED) &&
    isPastDate(detail.eventDate);

  const draftTag = detail.isDraft && (
    <IconTag
      color={detail.isComplete ? undefined : 'error'}
      icon={detail.isComplete ? undefined : AlertCircle}
    >
      {t('pipeline.draftTag')}
    </IconTag>
  );

  const summary = (
    <QuoteSummary
      subtotal={detail.subtotal}
      discountAmount={detail.discountAmount}
      longDistanceAmount={detail.longDistanceAmount}
      taxAmount={detail.taxAmount}
      cardSurchargeRate={detail.cardSurchargeRate}
      cardSurchargeAmount={detail.cardSurchargeAmount}
      total={detail.total}
      depositRate={detail.depositRate}
      depositAmount={detail.depositAmount}
    />
  );

  const stageRow = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <QuoteStageTagDropdown
            quoteId={detail.id}
            stageId={detail.stageId as QuoteStageId}
            isDraft={detail.isDraft}
          />
          {draftTag}
        </div>
        <div className="flex items-center gap-2">
          {hasPdf && <ShareButton url={detail.pdfUrl!} title={detail.number} iconOnly />}
          {showPdfAction && (
            <Button
              type="text"
              icon={<IconBadge icon={Download} shape="square" />}
              loading={isGeneratingPdf}
              onClick={onGeneratePdf}
            />
          )}
        </div>
      </div>
      {detail.pdfGeneratedAt && (
        <Typography.Text type="secondary" className="text-xs">
          {t('detail.pdfGeneratedAt', { date: dateTime(detail.pdfGeneratedAt) })}
        </Typography.Text>
      )}
    </div>
  );

  const headerRow = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex flex-1 flex-col gap-2">
        <QuoteNumberHeader
          number={detail.number}
          createdBy={
            detail.createdByName && t('pipeline.createdBy', { name: detail.createdByName })
          }
          onCopy={() => void handleCopyNumber()}
          quoteId={detail.id}
          createdByName={detail.createdByName}
          assignedToId={detail.assignedToId}
          assignedToName={detail.assignedToName}
        />
        {stageRow}
      </div>
    </div>
  );

  const eventSection = (
    <WrapperCard
      variant={isDesktop ? 'plain' : 'card'}
      title={t('builder.event.eventDetailsGroupTitle')}
    >
      <div className="flex flex-col gap-3">
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label={t('detail.dateLabel')}>{eventDateTime}</Descriptions.Item>
          <Descriptions.Item label={t('detail.typeLabel')}>
            {detail.eventTypeName ?? '—'}
          </Descriptions.Item>
        </Descriptions>
        <Descriptions column={1} size="small" layout={isDesktop ? 'horizontal' : 'vertical'}>
          <Descriptions.Item label={t('detail.addressLabel')}>
            {detail.address || detail.city ? (
              <AddressLines address={detail.address} city={detail.city} />
            ) : (
              '—'
            )}
          </Descriptions.Item>
        </Descriptions>
      </div>
    </WrapperCard>
  );

  return (
    <div className={`flex h-full flex-col ${isDesktop ? '' : 'gap-4'}`}>
      {isDesktop ? headerRow : <Card>{headerRow}</Card>}

      {isDesktop && <Divider className="my-4" />}

      <QuoteClientCard detail={detail} variant={isDesktop ? 'plain' : 'card'} />

      {isDesktop && <Divider className="my-4" />}

      {eventSection}

      {isDesktop && <Divider className="mt-4 mb-0" />}

      {isPastDue && (
        <WrapperAlert className="mt-4 mb-4" type="warning" showIcon title={t('detail.pastDue')} />
      )}

      <div className="flex-1">
        <QuoteLinesCard detail={detail} catalog={catalog} variant={isDesktop ? 'plain' : 'card'} />
      </div>

      {isDesktop && <Divider className="my-3" />}

      {isDesktop ? summary : <Card className="border-line border-2">{summary}</Card>}
    </div>
  );
}
