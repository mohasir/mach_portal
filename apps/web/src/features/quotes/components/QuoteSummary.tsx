'use client';
import { useState } from 'react';
import { Button, Divider } from 'antd';
import { Check, SquarePen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { IconBadge } from '@/components/shared/IconBadge';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';

const DEPOSIT_RATE_OPTIONS = [0.1, 0.2, 0.3, 0.4, 0.5];

interface QuoteSummaryProps {
  subtotal: number;
  discountAmount: number;
  longDistanceAmount: number;
  taxAmount: number;
  cardSurchargeRate: number;
  cardSurchargeAmount: number;
  total: number;
  depositRate: number;
  depositAmount: number;
  className?: string;
  onChangeDepositRate?: (rate: number) => void;
}

export function QuoteSummary({
  subtotal,
  discountAmount,
  longDistanceAmount,
  taxAmount,
  cardSurchargeRate,
  cardSurchargeAmount,
  total,
  depositRate,
  depositAmount,
  className,
  onChangeDepositRate,
}: QuoteSummaryProps) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();
  const [depositSheetOpen, setDepositSheetOpen] = useState(false);

  return (
    <div className={`flex  flex-col gap-2 text-base ${className ?? ''}`}>
      <div className="flex justify-between">
        <span className="text-gray-500">{t('builder.pricing.subtotal')}</span>
        <span>{money(subtotal)}</span>
      </div>
      {discountAmount > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.pricing.discount')}</span>
          <span>- {money(discountAmount)}</span>
        </div>
      )}
      {longDistanceAmount > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.pricing.longDistance')}</span>
          <span>{money(longDistanceAmount)}</span>
        </div>
      )}
      {taxAmount > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-500">{t('builder.pricing.taxShort')}</span>
          <span>{money(taxAmount)}</span>
        </div>
      )}
      {cardSurchargeAmount > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-500">
            {t('builder.pricing.cardSurcharge', { rate: Math.round(cardSurchargeRate * 100) })}
          </span>
          <span>{money(cardSurchargeAmount)}</span>
        </div>
      )}
      <div className="flex justify-between text-base font-semibold">
        <span>{t('builder.pricing.total')}</span>
        <span>{money(total)}</span>
      </div>
      <Divider className="my-1" />
      <div className="flex justify-between">
        <span className="flex items-center gap-1 text-gray-500">
          {t('builder.pricing.deposit', { rate: Math.round(depositRate * 100) })}
          {onChangeDepositRate && (
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
                  className="bg-primary text-ivory"
                />
              }
              onClick={() => setDepositSheetOpen(true)}
              aria-label={t('builder.pricing.editDeposit')}
            />
          )}
        </span>
        <span>{money(depositAmount)}</span>
      </div>
      {onChangeDepositRate && (
        <BottomSheet
          open={depositSheetOpen}
          onClose={() => setDepositSheetOpen(false)}
          title={t('builder.pricing.editDepositTitle')}
        >
          <div className="flex flex-col gap-1 p-4 pb-8">
            {DEPOSIT_RATE_OPTIONS.map((rate) => {
              const selected = rate === depositRate;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    onChangeDepositRate(rate);
                    setDepositSheetOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-base ${
                    selected ? 'bg-primary/5 text-primary font-semibold' : ''
                  }`}
                >
                  {Math.round(rate * 100)}%{selected && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
