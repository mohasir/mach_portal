'use client';
import { Button, Form, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../hooks/useConfig';
import { useUpdateConfig } from '../hooks/useUpdateConfig';
import { toFormValues, toUpdateInput, type SettingsFormValues } from '../helpers';
import { TaxRatesCard } from './TaxRatesCard';
import { QuoteDefaultsCard } from './QuoteDefaultsCard';

export function GeneralSettingsForm() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = useConfig();
  const { updateConfig, isPending } = useUpdateConfig();
  const [form] = Form.useForm<SettingsFormValues>();

  if (isLoading || !data) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  const onFinish = (values: SettingsFormValues) => {
    void updateConfig(toUpdateInput(values, data));
  };

  return (
    <Form
      key={String(data.appSettings.updatedAt)}
      form={form}
      layout="vertical"
      initialValues={toFormValues(data)}
      onFinish={onFinish}
      requiredMark={(label, { required }) =>
        typeof label === 'string' ? (
          <>
            {label}
            {required && <span className="text-error ml-1">*</span>}
          </>
        ) : (
          label
        )
      }
    >
      <div className="flex flex-col gap-10">
        <QuoteDefaultsCard lastUsedSeq={data.lastUsedSeq} />
        <TaxRatesCard states={data.stateSettings} />
      </div>

      <Button type="primary" htmlType="submit" loading={isPending} className="mt-6">
        {t('save')}
      </Button>
    </Form>
  );
}
