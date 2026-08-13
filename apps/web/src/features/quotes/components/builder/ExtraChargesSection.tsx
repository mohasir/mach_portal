'use client';
import { Form, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useConfig } from '@/features/settings';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';

interface ExtraChargesSectionProps {
  readOnly?: boolean;
}

export function ExtraChargesSection({ readOnly }: ExtraChargesSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const { data: config } = useConfig();

  const stateTaxRate = state.state
    ? (config?.stateSettings.find((s) => s.state === state.state)?.taxRate ?? 0)
    : 0;
  const cardSurchargeRate = config?.appSettings.cardSurchargeRate ?? 0;

  return (
    <WrapperCard title={t('builder.event.taxesGroupTitle')}>
      <Form layout="vertical" disabled={readOnly}>
        <Form.Item
          label={<FieldLabel title={t('builder.event.longDistance')} />}
          extra={
            state.state
              ? t('builder.event.longDistanceHint', {
                  rate: Math.round(stateTaxRate * 1000) / 10,
                })
              : undefined
          }
          className="mb-0"
        >
          <MoneyInput
            className="w-full"
            min={0}
            value={state.longDistanceAmount}
            onChange={(cents) => setFields({ longDistanceAmount: cents ?? 0 })}
          />
        </Form.Item>

        <SwitchRow
          className="mt-4"
          title={t('builder.event.cardSurcharge')}
          caption={t('builder.event.cardSurchargeHint', {
            rate: Math.round(cardSurchargeRate * 100),
          })}
          control={
            <Switch
              checked={state.applyCardSurcharge}
              onChange={(checked) => setFields({ applyCardSurcharge: checked })}
            />
          }
        />
      </Form>
    </WrapperCard>
  );
}
