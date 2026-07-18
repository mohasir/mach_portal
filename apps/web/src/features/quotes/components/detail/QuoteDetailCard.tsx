'use client';
import { Alert, Descriptions, Divider, Table, Typography, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { useConfig } from '@/features/settings';
import { Logo } from '@/components/shared/Logo';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import type { QuoteDetail } from '../../types';
import { QuoteSummary } from '../QuoteSummary';

interface QuoteDetailCardProps {
  detail: QuoteDetail;
  catalog: Product[];
}

type LineRow = QuoteDetail['lines'][number] & { product: Product };

export function QuoteDetailCard({ detail, catalog }: QuoteDetailCardProps) {
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-16 item-center justify-center">
          <Logo />
        </div>
        <div className="text-right">
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

      <Descriptions column={2} size="small">
        <Descriptions.Item label={t('detail.client')}>{detail.clientName}</Descriptions.Item>
        <Descriptions.Item label={t('detail.services')}>{detail.lines.length}</Descriptions.Item>
        <Descriptions.Item label={t('detail.eventDateTime')}>{eventDateTime}</Descriptions.Item>
        <Descriptions.Item label={t('builder.preview.eventType')}>
          {detail.eventTypeName ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.location')} span={2}>
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
