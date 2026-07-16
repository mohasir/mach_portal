'use client';
import { useState } from 'react';
import { Divider, Typography } from 'antd';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { getStationIcon } from '../../helpers';
import type { QuoteDetail } from '../../types';

interface QuoteIncludedServicesCardProps {
  detail: QuoteDetail;
  catalog: Product[];
}

export function QuoteIncludedServicesCard({ detail, catalog }: QuoteIncludedServicesCardProps) {
  const { t } = useTranslation('quotes');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <Typography.Title level={5} className="font-heading text-brown m-0!">
        {t('detail.includedServices')}
      </Typography.Title>
      <Divider className="mt-3 mb-3" />

      <div className="flex flex-col">
        {detail.lines.map((line) => {
          const product = catalog.find((p) => p.id === line.productId);
          if (!product) return null;
          const isExpanded = expandedIds.has(line.id);
          const StationIcon = getStationIcon(product.name);
          const groups = product.optionGroups
            .map((group) => {
              const isIncluded = group.selectionType === 'included';
              const selection = line.selections.find((s) => s.optionGroupId === group.id);
              const options = isIncluded
                ? group.options
                : group.options.filter((o) => selection?.optionIds.includes(o.id));
              return { group, isIncluded, options };
            })
            .filter(({ options }) => options.length > 0);
          const hasDetails = groups.length > 0;

          return (
            <div key={line.id} className="border-line border-b py-2 last:border-b-0">
              {hasDetails ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(line.id)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="shrink-0 text-gray-500" />
                  ) : (
                    <ChevronRight size={14} className="shrink-0 text-gray-500" />
                  )}
                  <StationIcon size={16} className="text-brown shrink-0" />
                  <Typography.Text strong className="text-sm">
                    {product.name}
                  </Typography.Text>
                </button>
              ) : (
                <div className="flex items-center gap-2 pl-5.5">
                  <StationIcon size={16} className="text-brown shrink-0" />
                  <Typography.Text strong className="text-sm">
                    {product.name}
                  </Typography.Text>
                </div>
              )}
              {isExpanded && hasDetails && (
                <div className="mt-1.5 flex flex-col gap-2 pl-6">
                  {groups.map(({ group, isIncluded, options }) => (
                    <div key={group.id} className="flex flex-col text-xs">
                      <span className="text-gray-500 mb-1 block">
                        {group.label}
                        {isIncluded ? ` | ${t('detail.includedLabel')}` : ''}:
                      </span>
                      <span>{options.map((option) => option.name).join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
