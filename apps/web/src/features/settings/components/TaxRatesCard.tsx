'use client';
import { Form, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import { STATE_NAMES } from '@repo/schemas';
import type { Config } from '../types';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { SettingsCard } from './SettingsCard';

interface TaxRatesCardProps {
  states: Config['stateSettings'];
}

export function TaxRatesCard({ states }: TaxRatesCardProps) {
  const { t } = useTranslation('settings');

  return (
    <SettingsCard title={t('taxRates.title')}>
      {states.map((s, index) => (
        <FieldRow key={s.state} title={STATE_NAMES[s.state]} required>
          <Form.Item
            name={['rates', index, 'taxRatePercent']}
            className="mb-0"
            rules={[{ required: true, message: t('validation.taxRateInvalid') }]}
          >
            <InputNumber
              min={0}
              max={100}
              step={0.001}
              precision={3}
              suffix="%"
              className="w-full"
            />
          </Form.Item>
        </FieldRow>
      ))}
    </SettingsCard>
  );
}
