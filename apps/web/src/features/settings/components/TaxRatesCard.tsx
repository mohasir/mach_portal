'use client';
import { Divider, Form, InputNumber, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Config } from '../types';

interface TaxRatesCardProps {
  states: Config['stateSettings'];
}

export function TaxRatesCard({ states }: TaxRatesCardProps) {
  const { t } = useTranslation('settings');

  return (
    <div>
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('taxRates.title')}
      </Typography.Title>
      <Divider className="mt-3 mb-6" />

      {states.map((s, index) => (
        <Form.Item
          key={s.state}
          name={['rates', index, 'taxRatePercent']}
          label={s.state}
          rules={[{ required: true, message: t('validation.taxRateInvalid') }]}
        >
          <InputNumber
            min={0}
            max={100}
            step={0.001}
            precision={3}
            suffix="%"
            className="w-full max-w-xs"
          />
        </Form.Item>
      ))}
    </div>
  );
}
