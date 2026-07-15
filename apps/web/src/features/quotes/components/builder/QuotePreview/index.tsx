'use client';
import { Card, Divider, Empty, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuoteTotals } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import type { EventType } from '@/features/event-types';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useQuoteBuilder } from '../../../hooks/useQuoteBuilder';

interface QuotePreviewProps {
  catalog: Product[];
  eventTypes: EventType[];
  totals: QuoteTotals;
}

export function QuotePreview({ catalog, eventTypes, totals }: QuotePreviewProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { state } = useQuoteBuilder();

  const eventType = eventTypes.find((e) => e.id === state.eventTypeId);

  return (
    <Card size="small" title={t('builder.preview.title')}>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.preview.client')}</span>
          <span className="font-medium">{state.clientName ?? '—'}</span>
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

      <Divider className="my-3" />

      {state.lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('builder.lines.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {state.lines.map((line) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;
            const includedOptions = product.optionGroups
              .filter((g) => g.selectionType === 'included')
              .flatMap((g) => g.options);
            const selectedOptions = product.optionGroups.flatMap((group) =>
              (line.selections[group.id] ?? [])
                .map((optionId) => group.options.find((o) => o.id === optionId))
                .filter((o) => o !== undefined),
            );

            return (
              <div key={line.key} className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="font-medium">{product.name}</span>
                  <span className="font-medium">{money(line.subtotal)}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {t('builder.preview.numPersons', { count: line.numPersons })}
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedOptions.map((option) => (
                    <Tag key={option.id}>{option.name}</Tag>
                  ))}
                  {includedOptions.map((option) => (
                    <Tag key={option.id} color="default">
                      {option.name}
                    </Tag>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Divider className="my-3" />

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.pricing.subtotal')}</span>
          <span>{money(totals.subtotal)}</span>
        </div>
        {totals.discountAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('builder.pricing.discount')}</span>
            <span>− {money(totals.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.pricing.taxShort')}</span>
          <span>{money(totals.taxAmount)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>{t('builder.pricing.total')}</span>
          <span>{money(totals.total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">
            {t('builder.pricing.deposit', { rate: Math.round(totals.depositRate * 100) })}
          </span>
          <span>{money(totals.depositAmount)}</span>
        </div>
      </div>
    </Card>
  );
}
