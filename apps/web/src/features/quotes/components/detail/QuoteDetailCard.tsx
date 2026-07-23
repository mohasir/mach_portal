'use client';
import { Alert, Button, Descriptions, Divider, Table, Typography, type TableColumnsType } from 'antd';
import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QUOTE_STAGE } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import { useConfig } from '@/features/settings';
import { Logo } from '@/components/shared/Logo';
import { isPastDate } from '@/lib/date';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import type { QuoteDetail } from '../../types';
import { QuoteSummary } from '../QuoteSummary';

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
  const { money } = useMoneyFormatter();
  const { data: config } = useConfig();

  const lineRows = detail.lines
    .map((line) => {
      const product = catalog.find((p) => p.id === line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((row): row is LineRow => row !== null);

  const columns: TableColumnsType<LineRow> = [
    {
      title: t('detail.description'),
      key: 'description',
      render: (_, row) => <span className="font-medium">{row.product.name}</span>,
    },
    {
      title: t('detail.quantity'),
      dataIndex: 'numPersons',
      key: 'numPersons',
      align: 'right',
      width: 96,
    },
    {
      title: t('builder.pricing.total'),
      dataIndex: 'subtotal',
      key: 'subtotal',
      align: 'right',
      width: 110,
      render: (value: number) => <span className="font-medium">{money(value)}</span>,
    },
  ];

  const eventDateTime = detail.eventDate
    ? `${date(detail.eventDate)}${detail.eventTime ? `, ${detail.eventTime}` : ''}`
    : (detail.eventTime ?? '—');

  const isPastDue =
    (detail.stageId === QUOTE_STAGE.PENDING || detail.stageId === QUOTE_STAGE.QUOTED) &&
    isPastDate(detail.eventDate);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="hidden h-16 items-center justify-center sm:flex">
          <Logo />
        </div>

        {/* Mobile: the topbar already shows the quote number as the page title, so just the
            date + a compact PDF button here. */}
        <div className="flex items-center justify-between gap-2 sm:hidden">
          <span className="text-xs text-gray-500">{date(detail.createdAt)}</span>
          {showPdfAction && (
            <Button
              type="primary"
              size="small"
              icon={<Download size={14} />}
              loading={isGeneratingPdf}
              onClick={onGeneratePdf}
            >
              {t('detail.generatePdf')}
            </Button>
          )}
        </div>

        <div className="hidden sm:block sm:text-right">
          <Typography.Text type="secondary" className="text-xs tracking-wide">
            {t('detail.title')}
          </Typography.Text>
          <div className="text-sm mt-1">
            <span className="text-gray-500">{t('detail.number')} </span>
            <span className="font-semibold">{detail.number}</span>
          </div>
          <div className="text-xs text-gray-500">{date(detail.createdAt)}</div>
        </div>
      </div>

      <Divider className="my-4" />

      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label={t('detail.client')}>{detail.clientName}</Descriptions.Item>
        <Descriptions.Item label={t('detail.services')}>{detail.lines.length}</Descriptions.Item>
        <Descriptions.Item label={t('detail.eventDateTime')}>{eventDateTime}</Descriptions.Item>
        <Descriptions.Item label={t('builder.preview.eventType')}>
          {detail.eventTypeName ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.location')} span={{ xs: 1, sm: 2 }}>
          {detail.address ?? '—'}
        </Descriptions.Item>
      </Descriptions>

      <Divider className="mt-4 mb-0" />

      {detail.validUntil && (
        <Alert
          className="mt-4 mb-4"
          type="info"
          showIcon
          title={t('detail.validUntil', {
            date: date(detail.validUntil),
            count: config?.appSettings.quoteValidityMonths ?? 0,
          })}
        />
      )}

      {isPastDue && (
        <Alert className="mt-4 mb-4" type="warning" showIcon title={t('detail.pastDue')} />
      )}

      <div className="flex-1">
        <Table<LineRow>
          size="small"
          pagination={false}
          rowKey="id"
          columns={columns}
          dataSource={lineRows}
        />
      </div>

      <Divider className="my-3" />

      <QuoteSummary
        subtotal={detail.subtotal}
        discountAmount={detail.discountAmount}
        taxAmount={detail.taxAmount}
        total={detail.total}
        depositRate={detail.depositRate}
        depositAmount={detail.depositAmount}
      />
    </div>
  );
}
