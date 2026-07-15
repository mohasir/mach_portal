'use client';
import { Button, Form, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../hooks/useConfig';
import { useUpdateConfig } from '../hooks/useUpdateConfig';
import { toFormValues, toUpdateInput, type SettingsFormValues } from '../helpers';
import { TaxRatesCard } from './TaxRatesCard';
import { QuoteDefaultsCard } from './QuoteDefaultsCard';
import { QuoteStagesCard } from './QuoteStagesCard';

export function GeneralSettingsForm() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = useConfig();
  const { updateConfig, isPending } = useUpdateConfig();
  const [form] = Form.useForm<SettingsFormValues>();
  const unchanged = useIsFormUnchanged(form, data ? toFormValues(data) : undefined);

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
      <div className="flex flex-col gap-6">
        <QuoteDefaultsCard lastUsedSeq={data.lastUsedSeq} />
        <TaxRatesCard states={data.stateSettings} />
        <QuoteStagesCard stages={data.quoteStages} />
      </div>

      <Button
        type="primary"
        htmlType="submit"
        loading={isPending}
        disabled={unchanged}
        className="mt-6"
      >
        {t('save')}
      </Button>
    </Form>
  );
}
