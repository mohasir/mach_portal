'use client';
import { Button, Card, Descriptions, Divider, Empty, Typography } from 'antd';
import { AlertCircle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import { useConfig } from '@/features/settings';
import { AddressLines } from '@/components/shared/AddressLines';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { IconTag } from '@/components/shared/IconTag';
import { Logo } from '@/components/shared/Logo';
import { ShareButton } from '@/components/shared/ShareButton';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import type { QuoteDetail } from '../../types';
import { QuickLineCard } from '../builder/QuickLineBuilder/QuickLineCard';
import { QuoteStageTagDropdown } from '../QuoteStageTagDropdown';
import { QuoteSummary } from '../QuoteSummary';
import { QuoteClientCard } from './QuoteClientCard';
import { IconBadge } from '@/components/shared/IconBadge';

interface QuoteDetailCardProps {
  detail: QuoteDetail;
  catalog: Product[];
  onGeneratePdf?: () => void;
  isGeneratingPdf?: boolean;
  showPdfAction?: boolean;
}

type LineRow = QuoteDetail['lines'][number] & { product: Product };

export function QuoteDetailCard({
  detail,
  catalog,
  onGeneratePdf,
  isGeneratingPdf,
  showPdfAction,
}: QuoteDetailCardProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { data: config } = useConfig();
  const isDesktop = useIsDesktop();
  const hasPdf = Boolean(detail.pdfUrl);

  const lineRows = detail.lines
    .map((line) => {
      const product = catalog.find((p) => p.id === line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((row): row is LineRow => row !== null);

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

  const linesGrid =
    lineRows.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('builder.lines.empty')} />
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {lineRows.map((row) => (
          <QuickLineCard
            key={row.id}
            mode="readOnly"
            line={{ numPersons: row.numPersons, subtotal: row.subtotal }}
            product={row.product}
          />
        ))}
      </div>
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

  const headerRow = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="hidden h-16 items-center justify-center sm:flex">
        <Logo />
      </div>

      <div className="flex items-center justify-between gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          <QuoteStageTagDropdown
            quoteId={detail.id}
            stageId={detail.stageId as QuoteStageId}
            isDraft={detail.isDraft}
          />
          {draftTag}
        </div>
        <div className="flex gap-2">
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

      <div className="hidden sm:flex sm:flex-col sm:items-end sm:text-right">
        <div className="mb-1 flex items-center gap-2">
          <QuoteStageTagDropdown
            quoteId={detail.id}
            stageId={detail.stageId as QuoteStageId}
            isDraft={detail.isDraft}
          />
          {draftTag}
        </div>
        <Typography.Text type="secondary" className="text-xs tracking-wide">
          {t('detail.title')}
        </Typography.Text>
        <div className="text-base mt-1">
          <span className="text-gray-500">{t('detail.number')} </span>
          <span className="font-semibold">{detail.number}</span>
        </div>
        <div className="text-xs text-gray-500">{date(detail.createdAt)}</div>
      </div>
    </div>
  );

  const eventSection = (
    <div className="flex flex-col gap-3">
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('builder.event.eventDetailsGroupTitle')}
      </Typography.Title>
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label={t('detail.dateLabel')}>{eventDateTime}</Descriptions.Item>
        <Descriptions.Item label={t('detail.typeLabel')}>
          {detail.eventTypeName ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.addressLabel')} span={{ xs: 1, sm: 2 }}>
          {detail.address || detail.city ? (
            <AddressLines address={detail.address} city={detail.city} lines={1} />
          ) : (
            '—'
          )}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );

  const productsSection = (
    <div className="flex flex-col gap-3">
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('builder.lines.title')}
        {lineRows.length > 0 && ` (${lineRows.length})`}
      </Typography.Title>
      {detail.validUntil && (
        <WrapperAlert
          type="info"
          showIcon
          title={t('detail.validUntil', {
            date: date(detail.validUntil),
            count: config?.appSettings.quoteValidityMonths ?? 0,
          })}
        />
      )}
      {linesGrid}
    </div>
  );

  return (
    <div className={`flex h-full flex-col ${isDesktop ? '' : 'gap-4'}`}>
      {isDesktop ? headerRow : <Card>{headerRow}</Card>}

      {isDesktop && <Divider className="my-4" />}

      {isDesktop ? (
        <QuoteClientCard detail={detail} />
      ) : (
        <Card>
          <QuoteClientCard detail={detail} />
        </Card>
      )}

      {isDesktop && <Divider className="my-4" />}

      {isDesktop ? eventSection : <Card>{eventSection}</Card>}

      {isDesktop && <Divider className="mt-4 mb-0" />}

      {isPastDue && (
        <WrapperAlert className="mt-4 mb-4" type="warning" showIcon title={t('detail.pastDue')} />
      )}

      <div className="flex-1">{isDesktop ? productsSection : <Card>{productsSection}</Card>}</div>

      {isDesktop && <Divider className="my-3" />}

      {isDesktop ? summary : <Card className="border-line border-2">{summary}</Card>}
    </div>
  );
}
