'use client';
import { Form, InputNumber, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { CURRENCY_OPTIONS } from '../contants';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { SettingsCard } from './SettingsCard';

interface QuoteDefaultsCardProps {
  lastUsedSeq: number;
}

export function QuoteDefaultsCard({ lastUsedSeq }: QuoteDefaultsCardProps) {
  const { t } = useTranslation('settings');
  const minSeqStart = Math.max(1, lastUsedSeq);

  return (
    <SettingsCard title={t('quoteDefaults.title')}>
      <FieldRow
        title={t('quoteDefaults.depositRate')}
        caption={t('quoteDefaults.depositRateCaption')}
        required
      >
        <Form.Item
          name="depositRatePercent"
          className="mb-0"
          rules={[{ required: true, message: t('validation.depositRateInvalid') }]}
        >
          <InputNumber min={0} max={100} step={1} precision={0} suffix="%" className="w-full" />
        </Form.Item>
      </FieldRow>

      <FieldRow
        title={t('quoteDefaults.quoteValidityMonths')}
        caption={t('quoteDefaults.quoteValidityMonthsCaption')}
        required
      >
        <Form.Item
          name="quoteValidityMonths"
          className="mb-0"
          rules={[{ required: true, message: t('validation.quoteValidityInvalid') }]}
        >
          <InputNumber min={1} className="w-full" suffix={t('quoteDefaults.months')} />
        </Form.Item>
      </FieldRow>

      <FieldRow
        title={t('quoteDefaults.minPersonsPerLine')}
        caption={t('quoteDefaults.minPersonsPerLineCaption')}
        required
      >
        <Form.Item
          name="minPersonsPerLine"
          className="mb-0"
          rules={[{ required: true, message: t('validation.minPersonsInvalid') }]}
        >
          <InputNumber min={1} className="w-full" />
        </Form.Item>
      </FieldRow>

      <FieldRow
        title={t('quoteDefaults.quoteSeqStart')}
        caption={t('quoteDefaults.quoteSeqStartCaption')}
        required
      >
        <Form.Item
          name="quoteSeqStart"
          className="mb-0"
          extra={t('quoteDefaults.lastUsedSeqHint', { seq: lastUsedSeq })}
          rules={[{ required: true, message: t('validation.quoteSeqStartInvalid') }]}
        >
          <InputNumber min={minSeqStart} className="w-full" />
        </Form.Item>
      </FieldRow>

      <FieldRow
        title={t('quoteDefaults.currency')}
        caption={t('quoteDefaults.currencyCaption')}
        required
      >
        <Form.Item
          name="currency"
          className="mb-0"
          rules={[{ required: true, message: t('validation.currencyInvalid') }]}
        >
          <Select options={CURRENCY_OPTIONS} className="w-full" />
        </Form.Item>
      </FieldRow>
    </SettingsCard>
  );
}
