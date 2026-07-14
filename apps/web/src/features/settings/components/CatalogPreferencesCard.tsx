'use client';
import { Divider, Flex, Form, Switch, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

export function CatalogPreferencesCard() {
  const { t } = useTranslation('settings');

  return (
    <div>
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('preferences.catalog.title')}
      </Typography.Title>
      <Divider className="mt-3 mb-6" />

      <Flex justify="space-between" align="center" gap={16}>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{t('preferences.catalog.sortable')}</div>
          <div className="text-muted text-sm">{t('preferences.catalog.sortableCaption')}</div>
        </div>
        <Form.Item name="catalogSortable" valuePropName="checked" noStyle>
          <Switch />
        </Form.Item>
      </Flex>
    </div>
  );
}
