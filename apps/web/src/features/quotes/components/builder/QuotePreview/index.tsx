'use client';
import { Divider, Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuoteTotals } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import type { EventType } from '@/features/event-types';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { getStationIcon } from '../../../helpers';
import { useQuoteBuilder } from '../../../hooks/useQuoteBuilder';
import { QuoteLineItem } from '../../QuoteLineItem';
import { QuoteSummary } from '../../QuoteSummary';

interface QuotePreviewProps {
  catalog: Product[];
  eventTypes: EventType[];
  totals: QuoteTotals;
  readOnly?: boolean;
}

export function QuotePreview({ catalog, eventTypes, totals, readOnly }: QuotePreviewProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { state, removeLine } = useQuoteBuilder();

  const eventType = eventTypes.find((e) => e.id === state.eventTypeId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Typography.Title level={4} className="font-heading text-brown m-0! shrink-0">
        {t('builder.preview.title')} {state.lines.length > 0 && `(${state.lines.length})`}
      </Typography.Title>
      <Divider className="mt-3 mb-3 shrink-0" />

      <div className="flex shrink-0 flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.preview.client')}</span>
          <span className="font-medium">{state.newClient?.name || state.clientName || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.preview.eventType')}</span>
          <span>{eventType?.name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.preview.eventDate')}</span>
          <span>{state.eventDate ? date(state.eventDate) : '—'}</span>
        </div>
        {state.address && <div className="text-gray-500">{state.address}</div>}
      </div>

      <Divider className="my-3 shrink-0" />

      {state.lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('builder.lines.empty')} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {[...state.lines]
            .sort((a, b) => {
              const nameA = catalog.find((p) => p.id === a.productId)?.name ?? '';
              const nameB = catalog.find((p) => p.id === b.productId)?.name ?? '';
              return nameA.localeCompare(nameB);
            })
            .map((line) => {
              const product = catalog.find((p) => p.id === line.productId);
              if (!product) return null;
              const groups = product.optionGroups
                .map((group) => {
                  const isIncluded = group.selectionType === 'included';
                  const options = isIncluded
                    ? group.options
                    : group.options.filter((o) => (line.selections[group.id] ?? []).includes(o.id));
                  return {
                    key: group.id,
                    label: group.label,
                    isIncluded,
                    optionNames: options.map((option) => option.name),
                  };
                })
                .filter((group) => group.optionNames.length > 0);

              return (
                <QuoteLineItem
                  key={line.key}
                  icon={getStationIcon(product.name)}
                  name={product.name}
                  numPersons={line.numPersons}
                  total={line.subtotal}
                  groups={groups}
                  onRemove={readOnly ? undefined : () => removeLine(line.key)}
                />
              );
            })}
        </div>
      )}

      <Divider className="my-3 shrink-0" />

      <QuoteSummary
        className="shrink-0"
        subtotal={totals.subtotal}
        discountAmount={totals.discountAmount}
        taxAmount={totals.taxAmount}
        total={totals.total}
        depositRate={totals.depositRate}
        depositAmount={totals.depositAmount}
      />
    </div>
  );
}
