'use client';
import { useState } from 'react';
import { Button, Divider, Empty, Tag, Typography } from 'antd';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
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
  readOnly?: boolean;
}

const LINE_GRID = 'grid grid-cols-[1fr_56px_76px_28px] items-center gap-2';

export function QuotePreview({ catalog, eventTypes, totals, readOnly }: QuotePreviewProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { state, removeLine } = useQuoteBuilder();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const eventType = eventTypes.find((e) => e.id === state.eventTypeId);

  const toggleExpanded = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <Typography.Title level={5} className="font-heading text-brown m-0!">
        {t('builder.preview.title')}
      </Typography.Title>
      <Divider className="mt-3 mb-3" />

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
        <div className="flex flex-col gap-2">
          <div className={`${LINE_GRID} text-xs text-gray-500`}>
            <span>{t('builder.preview.line.station')}</span>
            <span className="text-right">{t('builder.preview.line.persons')}</span>
            <span className="text-right">{t('builder.preview.line.total')}</span>
            <span />
          </div>

          {state.lines.map((line) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;
            const isExpanded = expandedKeys.has(line.key);
            const groups = product.optionGroups
              .map((group) => {
                const isIncluded = group.selectionType === 'included';
                const options = isIncluded
                  ? group.options
                  : group.options.filter((o) => (line.selections[group.id] ?? []).includes(o.id));
                return { group, isIncluded, options };
              })
              .filter(({ options }) => options.length > 0);

            return (
              <div key={line.key} className="flex flex-col gap-1">
                <div className={LINE_GRID}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(line.key)}
                    className="flex min-w-0 items-center gap-1 text-left font-medium"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="shrink-0 text-gray-500" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0 text-gray-500" />
                    )}
                    <span className="truncate">{product.name}</span>
                  </button>
                  <span className="text-right text-xs text-gray-500">{line.numPersons}</span>
                  <span className="text-right font-medium">{money(line.subtotal)}</span>
                  {readOnly ? (
                    <span />
                  ) : (
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() => removeLine(line.key)}
                      aria-label={t('builder.lines.remove')}
                    />
                  )}
                </div>
                {isExpanded && groups.length > 0 && (
                  <div className="flex flex-col gap-1 pl-5">
                    {groups.map(({ group, isIncluded, options }) => (
                      <div key={group.id} className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-gray-500">{group.label}:</span>
                        {options.map((option) => (
                          <Tag key={option.id} color={isIncluded ? 'default' : undefined}>
                            {option.name}
                          </Tag>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
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
            <span>- {money(totals.discountAmount)}</span>
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
    </div>
  );
}
