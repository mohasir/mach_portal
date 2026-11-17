'use client';
import { Empty, Switch, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useChargeTypeOptions } from '@/features/charge-types';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { PercentInput } from '@/components/shared/Inputs/PercentInput';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useFeature } from '@/lib/auth/useFeature';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import {
  chargeRowLabel,
  chargeValueError,
  isRetiredChargeType,
  offerableChargeTypes,
  toggleCharge,
  type BuilderCharge,
} from '../../chargeHelpers';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';

type AppliedChargeRow = BuilderCharge & { amount: number };

interface ExtraChargesSectionProps {
  readOnly?: boolean;
  /** The charges with the amount they add, shown when the add-on is off. */
  appliedRows: AppliedChargeRow[];
}

/** Charges of the quote read-only: the add-on is off, so they stay as they were applied. */
function AppliedCharges({ charges }: { charges: AppliedChargeRow[] }) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();

  return (
    <div className="flex flex-col gap-3">
      <WrapperAlert
        type="info"
        closeable={false}
        description={t('builder.charges.lockedCaption')}
      />
      {charges.map((charge, index) => (
        <div key={(charge.chargeTypeId ?? charge.name) + index} className="flex justify-between">
          <span>{chargeRowLabel(charge)}</span>
          <span className="text-gray-500">{money(charge.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function ChargeOptions({ readOnly }: { readOnly?: boolean }) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const { data: options = [], isLoading } = useChargeTypeOptions();
  const rows = offerableChargeTypes(options, state.charges);
  const activeIds = new Set(options.map((o) => o.id));

  const setValue = (chargeTypeId: string, value: number | null) =>
    setFields({
      charges: state.charges.map((c) =>
        c.chargeTypeId === chargeTypeId ? { ...c, value: value ?? 0 } : c,
      ),
    });

  if (!isLoading && rows.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('builder.charges.empty')} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {rows.map((type) => {
        const applied = state.charges.find((c) => c.chargeTypeId === type.id);
        const retired = isRetiredChargeType(type.id, activeIds, isLoading);
        return (
          <div key={type.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {type.name}
                  {retired && <Tag>{t('builder.charges.inactiveType')}</Tag>}
                </span>
                <Typography.Text type="secondary" className="text-xs">
                  {type.kind === 'percent'
                    ? t('builder.charges.percentHint')
                    : t('builder.charges.fixedHint')}
                </Typography.Text>
              </span>
              <Switch
                checked={!!applied}
                disabled={readOnly}
                aria-label={type.name}
                onChange={(checked) =>
                  setFields({ charges: toggleCharge(state.charges, type, checked) })
                }
              />
            </div>
            {applied &&
              (applied.kind === 'percent' ? (
                <PercentInput
                  className="w-full sm:max-w-48"
                  precision={3}
                  min={0.001}
                  disabled={readOnly || retired}
                  status={chargeValueError(applied) ? 'error' : undefined}
                  aria-label={t('builder.charges.valueLabel', { name: type.name })}
                  value={applied.value}
                  onChange={(rate) => setValue(type.id, rate)}
                />
              ) : (
                <MoneyInput
                  className="w-full sm:max-w-48"
                  min={0}
                  disabled={readOnly || retired}
                  status={chargeValueError(applied) ? 'error' : undefined}
                  aria-label={t('builder.charges.valueLabel', { name: type.name })}
                  value={applied.value}
                  onChange={(cents) => setValue(type.id, cents)}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

export function ExtraChargesSection({ readOnly, appliedRows }: ExtraChargesSectionProps) {
  const { t } = useTranslation('quotes');
  const chargesEnabled = useFeature('extraCharges');
  const { state } = useQuoteBuilder();

  if (!chargesEnabled && state.charges.length === 0) return null;

  return (
    <WrapperCard title={t('builder.charges.title')}>
      {chargesEnabled ? (
        <ChargeOptions readOnly={readOnly} />
      ) : (
        <AppliedCharges charges={appliedRows} />
      )}
    </WrapperCard>
  );
}
