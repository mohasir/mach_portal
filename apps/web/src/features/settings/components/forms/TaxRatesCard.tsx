'use client';
import { Button, Form, InputNumber, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { STATE_NAMES } from '@repo/schemas';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateTaxRates } from '../../hooks/useUpdateTaxRates';
import {
  toTaxRatesFormValues,
  toTaxRatesUpdateInput,
  type TaxRatesFormValues,
} from '../../helpers';
import { WrapperCard } from '@/components/shared/WrapperCard';

export function TaxRatesCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateTaxRates, isPending } = useUpdateTaxRates();
  const [form] = Form.useForm<TaxRatesFormValues>();
  const unchanged = useIsFormUnchanged(form, data ? toTaxRatesFormValues(data) : undefined);

  if (!can({ [RESOURCES.TAX_RATES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 3 }} />;

  const canEdit = can({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] });
  const onFinish = (values: TaxRatesFormValues) => {
    void updateTaxRates(toTaxRatesUpdateInput(values, data));
  };

  return (
    <WrapperCard title={t('taxRates.title')}>
      <Form
        key={JSON.stringify(data.stateSettings)}
        form={form}
        layout="vertical"
        initialValues={toTaxRatesFormValues(data)}
        onFinish={onFinish}
        disabled={!canEdit}
      >
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
    </WrapperCard>
  );
}
