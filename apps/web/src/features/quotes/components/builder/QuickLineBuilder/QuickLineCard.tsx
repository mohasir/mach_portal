'use client';
import { useState } from 'react';
import { Button, InputNumber, Select } from 'antd';
import { Minus, Plus, SquarePen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { getStationIcon } from '../../../helpers';
import type { LineDraft } from '../../../hooks/useQuoteBuilder';

interface QuickLineCardProps {
  line: LineDraft;
  product: Product;
  readOnly?: boolean;
  onRemove: () => void;
  onChange: (payload: Partial<Pick<LineDraft, 'numPersons' | 'subtotal'>>) => void;
}

export function QuickLineCard({ line, product, readOnly, onRemove, onChange }: QuickLineCardProps) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();
  const Icon = getStationIcon(product.name);
  const [editOpen, setEditOpen] = useState(false);

  const sortedTiers = [...product.priceTiers].sort((a, b) => a.numPersons - b.numPersons);
  const tierIndex = Math.max(
    0,
    sortedTiers.findIndex((tier) => tier.numPersons === line.numPersons),
  );

  const handleTierChange = (numPersons: number) => {
    const tier = product.priceTiers.find((pt) => pt.numPersons === numPersons);
    onChange({ numPersons, subtotal: tier ? tier.price : line.subtotal });
  };

  const stepTier = (direction: 1 | -1) => {
    const tier = sortedTiers[tierIndex + direction];
    if (tier) onChange({ numPersons: tier.numPersons, subtotal: tier.price });
  };

  return (
    <div className="border-line flex gap-3 rounded-lg border p-3">
      <div className="bg-olive-faint text-brown flex size-12 shrink-0 items-center justify-center rounded-lg">
        <Icon size={22} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate font-medium">{product.name}</span>
          {!readOnly && (
            <Button
              type="text"
              size="small"
              danger
              icon={<X size={16} />}
              onClick={onRemove}
              aria-label={t('builder.lines.remove')}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {readOnly ? (
            <span className="text-sm text-gray-500">
              {t('builder.lines.numPersonsCount', { count: line.numPersons })}
            </span>
          ) : (
            <Select
              className="w-36"
              value={line.numPersons}
              onChange={handleTierChange}
              options={product.priceTiers.map((tier) => ({
                value: tier.numPersons,
                label: t('builder.lines.numPersonsCount', { count: tier.numPersons }),
              }))}
            />
          )}
          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button
                type="text"
                size="small"
                icon={<SquarePen size={16} />}
                onClick={() => setEditOpen(true)}
                aria-label={t('builder.lines.edit')}
              />
            )}
            <span className="font-semibold">{money(line.subtotal)}</span>
          </div>
        </div>
      </div>

      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('builder.lines.editTitle')}
      >
        <div className="flex flex-col gap-4 p-4 pb-8">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">{t('builder.lines.numPersons')}</span>
            <div className="quantity-stepper border-line focus-within:border-primary flex h-10 items-center justify-between rounded-lg border px-1">
              <Button
                type="text"
                icon={<Minus size={16} />}
                disabled={tierIndex <= 0}
                onClick={() => stepTier(-1)}
                aria-label={t('builder.lines.decrease')}
              />
              <InputNumber
                variant="borderless"
                controls={false}
                min={1}
                precision={0}
                className="flex-1 text-center font-semibold"
                value={line.numPersons}
                onChange={(value) => onChange({ numPersons: value ?? 1 })}
              />
              <Button
                type="text"
                icon={<Plus size={16} />}
                disabled={tierIndex >= sortedTiers.length - 1}
                onClick={() => stepTier(1)}
                aria-label={t('builder.lines.increase')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">{t('builder.lines.price')}</span>
            <MoneyInput
              className="h-10 w-full"
              min={0}
              value={line.subtotal}
              onChange={(cents) => onChange({ subtotal: cents ?? 0 })}
            />
          </div>

          <Button type="primary" block onClick={() => setEditOpen(false)}>
            {t('builder.lines.editDone')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
