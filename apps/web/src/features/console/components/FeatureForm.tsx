'use client';
import { Alert, Button, Form, Input, InputNumber, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { WrapperDatePicker } from '@/components/shared/WrapperDatePicker';
import { formatIsoDay } from '@/lib/date';
import { isValidCurrency, type FeatureFormValues } from '../helpers';

// The date field holds a dayjs while editing; the API value is the 'YYYY-MM-DD' string.
interface FormState extends Omit<FeatureFormValues, 'expiresOn'> {
  expiresOn: Dayjs | null;
}

const toFormState = (values: FeatureFormValues): FormState => ({
  ...values,
  expiresOn: values.expiresOn ? dayjs(values.expiresOn) : null,
});

export function FeatureForm({
  initialValues,
  onSubmit,
  isPending,
  errorText,
}: {
  initialValues: FeatureFormValues;
  onSubmit: (values: FeatureFormValues) => Promise<void> | void;
  isPending: boolean;
  errorText?: string;
}) {
  const { t } = useTranslation('console');
  const [form] = Form.useForm<FormState>();

  return (
    <Form<FormState>
      form={form}
      layout="vertical"
      initialValues={toFormState(initialValues)}
      onFinish={(values) =>
        onSubmit({
          expiresOn: values.expiresOn ? formatIsoDay(values.expiresOn) : null,
          price: values.price ?? null,
          billingPeriod: values.billingPeriod ?? null,
          currency: values.currency ?? null,
        })
      }
      requiredMark={false}
    >
      {errorText && <Alert type="error" showIcon title={errorText} className="mb-4" />}

      <Form.Item
        name="expiresOn"
        label={
          <FieldLabel title={t('featureForm.expiresOn')} caption={t('featureForm.expiresOnHint')} />
        }
      >
        <WrapperDatePicker allowClear sheetTitle={t('featureForm.expiresOn')} className="w-full" />
      </Form.Item>

      <Form.Item
        name="price"
        label={<FieldLabel title={t('featureForm.price')} caption={t('featureForm.priceHint')} />}
      >
        <InputNumber<number> min={0} precision={2} className="w-full" />
      </Form.Item>

      <Form.Item name="billingPeriod" label={<FieldLabel title={t('featureForm.billingPeriod')} />}>
        <Select
          allowClear
          placeholder={t('featureForm.billingPeriodPlaceholder')}
          options={[
            { value: 'monthly', label: t('featureForm.periodMonthly') },
            { value: 'yearly', label: t('featureForm.periodYearly') },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="currency"
        label={
          <FieldLabel title={t('featureForm.currency')} caption={t('featureForm.currencyHint')} />
        }
        normalize={(value: string | undefined) => value?.toUpperCase()}
        rules={[
          {
            validator: (_, value: string | null | undefined) =>
              !value || isValidCurrency(value)
                ? Promise.resolve()
                : Promise.reject(new Error(t('featureForm.validation.currencyInvalid'))),
          },
        ]}
      >
        <Input maxLength={3} autoComplete="off" />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('featureForm.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
