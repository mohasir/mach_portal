'use client';
import { Card, Form, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
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

  return (
    <div>
      <Card>
        <Typography.Title level={4} className="font-heading text-brown m-0!">
          {t('builder.event.taxesGroupTitle')}
        </Typography.Title>

        <Form layout="vertical" disabled={readOnly} className="mt-4">
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
        </Form>
      </Card>
    </div>
  );
}
