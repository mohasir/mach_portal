'use client';
import { Divider, Form, Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { DiscountType, QuoteTotals } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { PercentInput } from '@/components/shared/Inputs/PercentInput';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';

interface PricingPanelProps {
  totals: QuoteTotals;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <Typography.Text
        type={strong ? undefined : 'secondary'}
        className={strong ? 'font-semibold' : undefined}
      >
        {label}
      </Typography.Text>
      <Typography.Text className={strong ? 'font-semibold' : undefined}>{value}</Typography.Text>
    </div>
  );
}

export function PricingPanel({ totals }: PricingPanelProps) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();
  const { state, setFields } = useQuoteBuilder();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <Form.Item
            label={<FieldLabel title={t('builder.pricing.discountType')} />}
            className="mb-0 flex-1"
          >
            <Select
              allowClear
              value={state.discountType ?? undefined}
              placeholder={t('builder.pricing.discountNone')}
              onChange={(value: DiscountType | undefined) =>
                setFields({
                  discountType: value ?? null,
                  discountValue: value ? state.discountValue : null,
                })
              }
              options={[
                { value: 'fixed', label: t('builder.pricing.discountFixed') },
                { value: 'percent', label: t('builder.pricing.discountPercent') },
              ]}
            />
          </Form.Item>
          {state.discountType && (
            <Form.Item
              label={<FieldLabel title={t('builder.pricing.discountValue')} />}
              className="mb-0 flex-1"
            >
              {state.discountType === 'fixed' ? (
                <MoneyInput
                  className="w-full"
                  min={0}
                  value={state.discountValue ?? 0}
                  onChange={(cents) => setFields({ discountValue: cents ?? 0 })}
                />
              ) : (
                <PercentInput
                  className="w-full"
                  value={state.discountValue ?? 0}
                  onChange={(rate) => setFields({ discountValue: rate ?? 0 })}
                />
              )}
            </Form.Item>
          )}
        </div>

        <Form.Item label={<FieldLabel title={t('builder.pricing.depositRate')} />} className="mb-0">
          <PercentInput
            className="w-full max-w-40"
            value={state.depositRate}
            onChange={(rate) => setFields({ depositRate: rate ?? 0 })}
          />
        </Form.Item>
      </div>

      <Divider className="my-1" />

      <div className="flex flex-col gap-1.5 text-sm">
        <Row label={t('builder.pricing.subtotal')} value={money(totals.subtotal)} />
        {totals.discountAmount > 0 && (
          <Row label={t('builder.pricing.discount')} value={`- ${money(totals.discountAmount)}`} />
        )}
        {totals.longDistanceAmount > 0 && (
          <Row label={t('builder.pricing.longDistance')} value={money(totals.longDistanceAmount)} />
        )}
        <Row
          label={t('builder.pricing.tax', { rate: Math.round(totals.taxRate * 1000) / 10 })}
          value={money(totals.taxAmount)}
        />
        <Divider className="my-1" />
        <Row label={t('builder.pricing.total')} value={money(totals.total)} strong />
        <Row
          label={t('builder.pricing.deposit', { rate: Math.round(totals.depositRate * 100) })}
          value={money(totals.depositAmount)}
        />
        <Row
          label={t('builder.pricing.balance')}
          value={money(totals.total - totals.depositAmount)}
        />
      </div>
    </div>
  );
}
