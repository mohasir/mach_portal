'use client';
import { useState } from 'react';
import { Button, InputNumber, Select, Tag } from 'antd';
import { Eye, ListChecks, Minus, Plus, SquarePen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { IconBadge } from '@/components/shared/IconBadge';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { getStationIcon } from '../../../helpers';

interface QuickLineCardBaseProps {
  line: { numPersons: number; subtotal: number };
  product: Product;
}

type QuickLineCardProps = QuickLineCardBaseProps &
  (
    | {
        mode: 'edit';
        canEditPricing: boolean;
        onRemove: () => void;
        onChange: (payload: { numPersons?: number; subtotal?: number }) => void;
      }
    | {
        mode: 'selection';
        onEditSelection: () => void;
        onShow: () => void;
        line: { selections: { optionGroupId: string; optionIds: string[] }[] };
      }
    | { mode: 'readOnly' }
  );

export function QuickLineCard(props: QuickLineCardProps) {
  const { line, product, mode } = props;
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();
  const Icon = getStationIcon(product.name);
  const [editOpen, setEditOpen] = useState(false);

  const selectGroups = product.optionGroups.filter((group) => group.selectionType === 'select');
  const completedGroups =
    mode === 'selection'
      ? selectGroups.filter(
          (group) =>
            (props.line.selections.find((s) => s.optionGroupId === group.id)?.optionIds.length ??
              0) > 0,
        ).length
      : 0;

  const sortedTiers = [...product.priceTiers].sort((a, b) => a.numPersons - b.numPersons);
  const tierIndex = Math.max(
    0,
    sortedTiers.findIndex((tier) => tier.numPersons === line.numPersons),
  );

  const handleTierChange = (numPersons: number) => {
    if (mode !== 'edit') return;
    const tier = product.priceTiers.find((pt) => pt.numPersons === numPersons);
    props.onChange({ numPersons, subtotal: tier ? tier.price : line.subtotal });
  };

  const stepTier = (direction: 1 | -1) => {
    if (mode !== 'edit') return;
    const tier = sortedTiers[tierIndex + direction];
    if (tier) props.onChange({ numPersons: tier.numPersons, subtotal: tier.price });
  };

  return (
    <div className="border-line flex gap-3 rounded-xl border p-2">
      <div className="bg-olive-faint text-brown flex size-12 shrink-0 items-center justify-center rounded-lg">
        <Icon size={22} />
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col ${
          mode === 'edit' ? 'gap-3' : mode === 'selection' ? 'gap-1' : 'gap-2'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-base font-medium">{product.name}</span>
          {mode === 'edit' && (
            <Button
              type="text"
              size="small"
              danger
              icon={
                <IconBadge
                  icon={X}
                  shape="square"
                  badgeSize="xs"
                  size={12}
                  rounded="rounded-md"
                  className="bg-salmon/20 text-error"
                />
              }
              onClick={props.onRemove}
              aria-label={t('builder.lines.remove')}
            />
          )}
          {mode === 'selection' && selectGroups.length > 0 && (
            <Tag
              className="m-0 shrink-0"
              color={
                completedGroups === 0
                  ? 'orange'
                  : completedGroups === selectGroups.length
                    ? 'green'
                    : 'default'
              }
            >
              {completedGroups === 0
                ? t('builder.lines.selectionsPending')
                : t('builder.lines.selectionsCount', {
                    done: completedGroups,
                    total: selectGroups.length,
                  })}
            </Tag>
          )}
        </div>

        <div className="flex flex-col gap-2 min-[375px]:flex-row min-[375px]:items-center min-[375px]:justify-between">
          {mode === 'edit' ? (
            <Select
              className="w-36 py-1"
              size="small"
              value={line.numPersons}
              onChange={handleTierChange}
              options={product.priceTiers.map((tier) => ({
                value: tier.numPersons,
                label: t('builder.lines.numPersonsCount', { count: tier.numPersons }),
              }))}
            />
          ) : (
            <span className="text-base text-gray-500">
              {t('builder.lines.numPersonsCount', { count: line.numPersons })}
            </span>
          )}
          <div className="flex items-center gap-2">
            {mode === 'edit' && props.canEditPricing && (
              <Button
                type="text"
                size="small"
                icon={
                  <IconBadge
                    icon={SquarePen}
                    shape="square"
                    badgeSize="xs"
                    size={12}
                    rounded="rounded-md"
                    className="bg-primary text-white"
                  />
                }
                onClick={() => setEditOpen(true)}
                aria-label={t('builder.lines.edit')}
              />
            )}
            {mode === 'selection' && (
              <>
                <Button
                  type="text"
                  size="small"
                  icon={<Eye size={16} />}
                  onClick={props.onShow}
                  aria-label={t('builder.lines.show')}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ListChecks size={16} />}
                  onClick={props.onEditSelection}
                  aria-label={t('builder.lines.editSelections')}
                />
              </>
            )}
            {mode !== 'selection' && (
              <span className="font-semibold text-base">{money(line.subtotal)}</span>
            )}
          </div>
        </div>
      </div>

      {mode === 'edit' && (
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
                  onChange={(value) => props.onChange({ numPersons: value ?? 1 })}
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
                onChange={(cents) => props.onChange({ subtotal: cents ?? 0 })}
              />
            </div>

            <Button type="primary" block onClick={() => setEditOpen(false)}>
              {t('builder.lines.editDone')}
            </Button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
