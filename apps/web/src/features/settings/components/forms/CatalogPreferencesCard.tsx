'use client';
import { Button, Flex, Form, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateCatalogPreferences } from '../../hooks/useUpdateCatalogPreferences';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface CatalogPreferencesFormValues {
  catalogSortable: boolean;
}

export function CatalogPreferencesCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateCatalogPreferences, isPending } = useUpdateCatalogPreferences();
  const [form] = Form.useForm<CatalogPreferencesFormValues>();
  const unchanged = useIsFormUnchanged(
    form,
    data ? { catalogSortable: data.appSettings.catalogSortable } : undefined,
  );

  if (!can({ [RESOURCES.CATALOG_PREFERENCES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 2 }} />;

  const canEdit = can({ [RESOURCES.CATALOG_PREFERENCES]: [ACTIONS.UPDATE] });
  const onFinish = (values: CatalogPreferencesFormValues) => {
    void updateCatalogPreferences({ catalogSortable: values.catalogSortable });
  };

  return (
    <WrapperCard title={t('preferences.catalog.title')}>
      <Form
        key={String(data.appSettings.updatedAt)}
        form={form}
        layout="vertical"
        initialValues={{ catalogSortable: data.appSettings.catalogSortable }}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <Flex justify="space-between" align="start" gap={16}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
            <span>{t('preferences.catalog.sortable')}</span>
            <span className="text-gray-500 text-xs font-normal">
              {t('preferences.catalog.sortableCaption')}
            </span>
          </span>
          <Form.Item name="catalogSortable" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </Flex>

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
