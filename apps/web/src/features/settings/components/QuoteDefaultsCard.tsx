'use client';
import { Button, Form, InputNumber, Select, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { CURRENCY_OPTIONS } from '../contants';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../hooks/useConfig';
import { useUpdateQuoteDefaults } from '../hooks/useUpdateQuoteDefaults';
import {
  toQuoteDefaultsFormValues,
  toQuoteDefaultsUpdateInput,
  type QuoteDefaultsFormValues,
} from '../helpers';
import { SettingsCard } from './SettingsCard';

export function QuoteDefaultsCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateQuoteDefaults, isPending } = useUpdateQuoteDefaults();
  const [form] = Form.useForm<QuoteDefaultsFormValues>();
  const unchanged = useIsFormUnchanged(form, data ? toQuoteDefaultsFormValues(data) : undefined);

  if (!can({ [RESOURCES.QUOTE_DEFAULTS]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 5 }} />;

  const canEdit = can({ [RESOURCES.QUOTE_DEFAULTS]: [ACTIONS.UPDATE] });
  const minSeqStart = Math.max(1, data.lastUsedSeq);
  const onFinish = (values: QuoteDefaultsFormValues) => {
    void updateQuoteDefaults(toQuoteDefaultsUpdateInput(values));
  };

  return (
    <Form
      key={String(data.appSettings.updatedAt)}
      form={form}
      layout="vertical"
      initialValues={toQuoteDefaultsFormValues(data)}
      onFinish={onFinish}
      disabled={!canEdit}
    >
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
            extra={t('quoteDefaults.lastUsedSeqHint', { seq: data.lastUsedSeq })}
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

        <FieldRow
          title={t('quoteDefaults.optionsSelectionDeadlineDays')}
          caption={t('quoteDefaults.optionsSelectionDeadlineDaysCaption')}
          required
        >
          <Form.Item
            name="optionsSelectionDeadlineDays"
            className="mb-0"
            rules={[
              { required: true, message: t('validation.optionsSelectionDeadlineDaysInvalid') },
            ]}
          >
            <InputNumber min={0} className="w-full" suffix={t('quoteDefaults.days')} />
          </Form.Item>
        </FieldRow>
      </SettingsCard>

      {canEdit && (
        <Button
          type="primary"
          htmlType="submit"
          loading={isPending}
          disabled={unchanged}
          className="mt-6"
        >
          {t('save')}
        </Button>
      )}
    </Form>
  );
}
