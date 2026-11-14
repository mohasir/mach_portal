'use client';
import { Button, Collapse, InputNumber, Select } from 'antd';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useLineConfig } from '../../../hooks/useLineConfig';
import type { LineDraft } from '../../../hooks/useQuoteBuilder';
import { isQuantityLocked, lineSubtotalForQuantity, usesTierPicker } from '../../../lineHelpers';
import { OptionGroupChips } from './OptionGroupChips';

interface LineCardProps {
  line: LineDraft;
  product: Product;
  readOnly?: boolean;
  canEditPricing: boolean;
  onRemove: () => void;
  onChange: (payload: Partial<Pick<LineDraft, 'numPersons' | 'subtotal'>>) => void;
  onSelectionChange: (optionGroupId: string, optionIds: string[]) => void;
}

export function LineCard({
  line,
  product,
  readOnly,
  canEditPricing,
  onRemove,
  onChange,
  onSelectionChange,
}: LineCardProps) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();
  const { priceTiersEnabled, configurableOptions, minPersons } = useLineConfig();
  const tierPicker = usesTierPicker(product, priceTiersEnabled);
  const quantityLocked = isQuantityLocked(product, priceTiersEnabled);

  const handleTierChange = (numPersons: number) => {
    const tier = product.priceTiers.find((pt) => pt.numPersons === numPersons);
    onChange({ numPersons, subtotal: tier ? tier.price : line.subtotal });
  };

  const handleQuantityChange = (value: number | null) => {
    const numPersons = value ?? minPersons;
    onChange({
      numPersons,
      subtotal: lineSubtotalForQuantity(product.price, numPersons, line.subtotal),
    });
  };

  return (
    <Collapse
      size="small"
      defaultActiveKey={['line']}
      items={[
        {
          key: 'line',
          label: product.name,
          extra: !readOnly && (
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={t('builder.lines.remove')}
            />
          ),
          children: (
            <>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">{t('builder.lines.numPersons')}</span>
                  {tierPicker ? (
                    <Select
                      disabled={readOnly}
                      value={line.numPersons}
                      onChange={handleTierChange}
                      options={product.priceTiers.map((tier) => ({
                        value: tier.numPersons,
                        label: `${tier.numPersons} — ${money(tier.price)}`,
                      }))}
                    />
                  ) : (
                    <>
                      <InputNumber
                        disabled={readOnly || quantityLocked}
                        className="w-full"
                        min={minPersons}
                        precision={0}
                        value={line.numPersons}
                        onChange={handleQuantityChange}
                      />
                      {quantityLocked && !readOnly && (
                        <span className="text-muted text-xs">{t('builder.lines.notQuotable')}</span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">{t('builder.lines.price')}</span>
                  <MoneyInput
                    disabled={readOnly || !canEditPricing}
                    className="w-full"
                    min={0}
                    value={line.subtotal}
                    onChange={(cents) => onChange({ subtotal: cents ?? 0 })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {product.optionGroups.map((group) => (
                  <OptionGroupChips
                    key={group.id}
                    group={group}
                    selectedIds={line.selections[group.id] ?? []}
                    onChange={(optionIds) => onSelectionChange(group.id, optionIds)}
                    readOnly={readOnly || !configurableOptions}
                  />
                ))}
              </div>
            </>
          ),
        },
      ]}
    />
  );
}
