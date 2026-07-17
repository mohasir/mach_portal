'use client';
import { Flex, Form, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { SettingsCard } from './SettingsCard';

export function CatalogPreferencesCard() {
  const { t } = useTranslation('settings');

  return (
    <SettingsCard title={t('preferences.catalog.title')}>
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
    </SettingsCard>
  );
}
