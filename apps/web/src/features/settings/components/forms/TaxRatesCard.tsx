'use client';
import { App, Button, Form, InputNumber, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateTaxPreferences } from '../../hooks/useUpdateTaxPreferences';
import {
  toDefaultTaxFormValues,
  toDefaultTaxUpdateInput,
  type DefaultTaxFormValues,
} from '../../helpers';

export function TaxRatesCard() {
  const { t } = useTranslation('settings');
  const { message } = App.useApp();
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateTaxPreferences, isPending } = useUpdateTaxPreferences();
  const [form] = Form.useForm<DefaultTaxFormValues>();
  const initialValues = data ? toDefaultTaxFormValues(data) : undefined;
  const unchanged = useIsFormUnchanged(form, initialValues);

  if (!can({ [RESOURCES.TAX_RATES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 2 }} />;

  const canEdit = can({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] });
  const onFinish = async (values: DefaultTaxFormValues) => {
    await updateTaxPreferences(toDefaultTaxUpdateInput(values));
    message.success(t('saveSuccess'));
  };

  return (
    <WrapperCard title={t('taxRates.title')}>
      <Form
        key={JSON.stringify(initialValues)}
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <FieldRow
          title={t('taxRates.defaultRate')}
          caption={t('taxRates.defaultRateCaption')}
          required
        >
          <Form.Item
            name="defaultTaxRatePercent"
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

        {canEdit && (
          <Button
            type="primary"
            htmlType="submit"
            loading={isPending}
            disabled={unchanged}
            className="mt-2"
          >
            {t('save')}
          </Button>
        )}
      </Form>
    </WrapperCard>
  );
}
