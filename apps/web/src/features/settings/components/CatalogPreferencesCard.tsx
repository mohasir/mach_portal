'use client';
import { Card, Divider, Flex, Form, Switch, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

export function CatalogPreferencesCard() {
  const { t } = useTranslation('settings');

  return (
    <Card>
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('preferences.catalog.title')}
      </Typography.Title>
      <Divider className="mt-3 mb-6" />

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
    </Card>
  );
}
