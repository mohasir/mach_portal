'use client';
import { App, Button, Flex, Form, InputNumber, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { STATE_NAMES } from '@repo/schemas';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateTaxPreferences } from '../../hooks/useUpdateTaxPreferences';
import { useUpdateTaxRates } from '../../hooks/useUpdateTaxRates';
import {
  toTaxRatesFormValues,
  toTaxRatesUpdateInput,
  type TaxRatesFormValues,
} from '../../helpers';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface TaxRatesCardFormValues extends TaxRatesFormValues {
  applyTaxByState: boolean;
}

export function TaxRatesCard() {
  const { t } = useTranslation('settings');
  const { message } = App.useApp();
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateTaxRates, isPending: isUpdatingRates } = useUpdateTaxRates();
  const { updateTaxPreferences, isPending: isUpdatingPreferences } = useUpdateTaxPreferences();
  const [form] = Form.useForm<TaxRatesCardFormValues>();
  const applyTaxByState = Form.useWatch('applyTaxByState', form);
  const rates = Form.useWatch('rates', form);
  const initialValues = data
    ? { applyTaxByState: data.appSettings.applyTaxByState, ...toTaxRatesFormValues(data) }
    : undefined;
  const unchanged = useIsFormUnchanged(form, initialValues);
  const hasPositiveRate = (rates ?? []).some((r) => (r?.taxRatePercent ?? 0) > 0);
  const ratesInvalid = !!applyTaxByState && !hasPositiveRate;

  if (!can({ [RESOURCES.TAX_RATES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 3 }} />;

  const canEdit = can({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] });
  const onFinish = async (values: TaxRatesCardFormValues) => {
    const tasks = [updateTaxPreferences({ applyTaxByState: values.applyTaxByState })];
    // The rate fields never register while hidden (switch off) — nothing to save for them then.
    if (values.rates) tasks.push(updateTaxRates(toTaxRatesUpdateInput(values, data)));
    await Promise.all(tasks);
    message.success(t('saveSuccess'));
  };

  return (
    <WrapperCard title={t('taxRates.title')}>
      <Form
        key={JSON.stringify(data.stateSettings) + String(data.appSettings.applyTaxByState)}
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <Flex justify="space-between" align="start" gap={16} className="mb-4">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
            <span>{t('taxRates.applyByState')}</span>
            <span className="text-gray-500 text-xs font-normal">
              {t('taxRates.applyByStateCaption')}
            </span>
          </span>
          <Form.Item name="applyTaxByState" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </Flex>

        {applyTaxByState && (
          <>
            {data.stateSettings.map((s, index) => (
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
            {ratesInvalid && (
              <span className="text-error mt-1 block text-xs">
                {t('validation.taxRatesAllZeroInvalid')}
              </span>
            )}
          </>
        )}

        {canEdit && (
          <Button
            type="primary"
            htmlType="submit"
            loading={isUpdatingRates || isUpdatingPreferences}
            disabled={unchanged || ratesInvalid}
            className="mt-6"
          >
            {t('save')}
          </Button>
        )}
      </Form>
    </WrapperCard>
  );
}
