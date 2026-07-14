'use client';
import { Divider, Form, InputNumber, Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

// Curated shortlist for the Select; the server accepts any ISO 4217 code
// (docs/mach-bar-domain.md D15 theme: schema stays reusable for other markets).
const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
];

// Label + explanatory caption stacked above the field (instead of AntD's
// `extra`, which renders below the control). Owns its own required marker
// (right after the title) since the Form's requiredMark only auto-appends
// for plain string labels.
function FieldLabel({
  title,
  caption,
  required,
}: {
  title: string;
  caption: string;
  required?: boolean;
}) {
  return (
    <span className="flex flex-col gap-0.5 py-1">
      <span>
        {title}
        {required && <span className="text-error ml-1">*</span>}
      </span>
      <span className="text-gray-500 text-xs font-normal">{caption}</span>
    </span>
  );
}

interface QuoteDefaultsCardProps {
  lastUsedSeq: number;
}

export function QuoteDefaultsCard({ lastUsedSeq }: QuoteDefaultsCardProps) {
  const { t } = useTranslation('settings');
  const minSeqStart = Math.max(1, lastUsedSeq);

  return (
    <div>
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('quoteDefaults.title')}
      </Typography.Title>
      <Divider className="mt-3 mb-6" />

      <Form.Item
        name="depositRatePercent"
        label={
          <FieldLabel
            title={t('quoteDefaults.depositRate')}
            caption={t('quoteDefaults.depositRateCaption')}
            required
          />
        }
        rules={[{ required: true, message: t('validation.depositRateInvalid') }]}
      >
        <InputNumber
          min={0}
          max={100}
          step={1}
          precision={0}
          suffix="%"
          className="w-full max-w-xs"
        />
      </Form.Item>

      <Form.Item
        name="quoteValidityMonths"
        label={
          <FieldLabel
            title={t('quoteDefaults.quoteValidityMonths')}
            caption={t('quoteDefaults.quoteValidityMonthsCaption')}
            required
          />
        }
        rules={[{ required: true, message: t('validation.quoteValidityInvalid') }]}
      >
        <InputNumber min={1} className="w-full max-w-xs" suffix={t('quoteDefaults.months')} />
      </Form.Item>

      <Form.Item
        name="minPersonsPerLine"
        label={
          <FieldLabel
            title={t('quoteDefaults.minPersonsPerLine')}
            caption={t('quoteDefaults.minPersonsPerLineCaption')}
            required
          />
        }
        rules={[{ required: true, message: t('validation.minPersonsInvalid') }]}
      >
        <InputNumber min={1} className="w-full max-w-xs" />
      </Form.Item>

      <Form.Item
        name="quoteSeqStart"
        label={
          <FieldLabel
            title={t('quoteDefaults.quoteSeqStart')}
            caption={t('quoteDefaults.quoteSeqStartCaption')}
            required
          />
        }
        extra={t('quoteDefaults.lastUsedSeqHint', { seq: lastUsedSeq })}
        rules={[{ required: true, message: t('validation.quoteSeqStartInvalid') }]}
      >
        <InputNumber min={minSeqStart} className="w-full max-w-xs" />
      </Form.Item>

      <Form.Item
        name="currency"
        label={
          <FieldLabel
            title={t('quoteDefaults.currency')}
            caption={t('quoteDefaults.currencyCaption')}
            required
          />
        }
        rules={[{ required: true, message: t('validation.currencyInvalid') }]}
      >
        <Select options={CURRENCY_OPTIONS} className="w-full max-w-xs" />
      </Form.Item>
    </div>
  );
}
