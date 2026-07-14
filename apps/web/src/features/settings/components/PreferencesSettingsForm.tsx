'use client';
import { Button, Form, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../hooks/useConfig';
import { useUpdateConfig } from '../hooks/useUpdateConfig';
import { CatalogPreferencesCard } from './CatalogPreferencesCard';

interface PreferencesFormValues {
  catalogSortable: boolean;
}

export function PreferencesSettingsForm() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = useConfig();
  const { updateConfig, isPending } = useUpdateConfig();
  const [form] = Form.useForm<PreferencesFormValues>();
  const unchanged = useIsFormUnchanged(
    form,
    data ? { catalogSortable: data.appSettings.catalogSortable } : undefined,
  );

  if (isLoading || !data) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  const onFinish = (values: PreferencesFormValues) => {
    void updateConfig({
      stateSettings: data.stateSettings.map(({ state, taxRate }) => ({ state, taxRate })),
      appSettings: { ...data.appSettings, catalogSortable: values.catalogSortable },
    });
  };

  return (
    <Form
      key={String(data.appSettings.updatedAt)}
      form={form}
      layout="vertical"
      initialValues={{ catalogSortable: data.appSettings.catalogSortable }}
      onFinish={onFinish}
      requiredMark={false}
    >
      <div className="flex flex-col gap-10">
        <CatalogPreferencesCard />
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
