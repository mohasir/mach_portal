'use client';
import { useState } from 'react';
import { Empty, Flex, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { filterOrganizations } from '../helpers';
import { OrganizationList, type OrganizationListProps } from './OrganizationList';

export function OrganizationSearchList({ items, ...listProps }: OrganizationListProps) {
  const { t } = useTranslation('tenant');
  const [search, setSearch] = useState('');
  const filtered = filterOrganizations(items, search);

  return (
    <Flex vertical gap={8}>
      <Input.Search
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('select.searchPlaceholder')}
      />
      <div className="max-h-72 overflow-y-auto">
        {filtered.length ? (
          <OrganizationList items={filtered} {...listProps} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('select.noResults')} />
        )}
      </div>
    </Flex>
  );
}
