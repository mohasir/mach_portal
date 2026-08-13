'use client';
import { Button, Form, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateCatalogPreferences } from '../../hooks/useUpdateCatalogPreferences';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
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
        <SwitchRow
          title={t('preferences.catalog.sortable')}
          caption={t('preferences.catalog.sortableCaption')}
          control={
            <Form.Item name="catalogSortable" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          }
        />

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
