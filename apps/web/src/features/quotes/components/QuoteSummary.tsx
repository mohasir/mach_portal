'use client';
import { Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';

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
}: QuoteSummaryProps) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();

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
        <span className="text-gray-500">
          {t('builder.pricing.deposit', { rate: Math.round(depositRate * 100) })}
        </span>
        <span>{money(depositAmount)}</span>
      </div>
    </div>
  );
}
