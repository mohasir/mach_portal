'use client';
import { Typography, type TableColumnsType } from 'antd';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { CONSOLE_ROUTE } from '@/lib/auth/navigation';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useOrganizationRowActions } from '../hooks/useOrganizationRowActions';
import type { ConsoleOrganizationRow } from '../types';
import { ExpiryTag } from './ExpiryTag';

export function useOrganizationColumns({
  onView,
}: {
  onView: (row: ConsoleOrganizationRow) => void;
}): TableColumnsType<ConsoleOrganizationRow> {
  const { t } = useTranslation('console');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useOrganizationRowActions({ onView });

  return [
    {
      title: t('organizations.columns.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string, row) => (
        <Link
          href={`${CONSOLE_ROUTE}/organizations/${row.id}`}
          onClick={(event) => event.stopPropagation()}
          className="text-navy font-medium"
        >
          {name}
        </Link>
      ),
    },
    {
      title: t('organizations.columns.slug'),
      dataIndex: 'slug',
      key: 'slug',
      responsive: ['sm'],
      render: (slug: string) => <Typography.Text type="secondary">{slug}</Typography.Text>,
    },
    {
      title: t('organizations.columns.catalog'),
      dataIndex: 'catalogKind',
      key: 'catalogKind',
      responsive: ['md'],
      render: (kind: ConsoleOrganizationRow['catalogKind']) => t(`vocabulary:${kind}.Items`),
    },
    {
      title: t('organizations.columns.features'),
      dataIndex: 'activeFeatureCount',
      key: 'activeFeatureCount',
      responsive: ['md'],
    },
    {
      title: t('organizations.columns.expiry'),
      dataIndex: 'nextExpiry',
      key: 'nextExpiry',
      responsive: ['lg'],
      render: (nextExpiry: string | null) => <ExpiryTag expiresAt={nextExpiry} />,
    },
    {
      title: t('organizations.columns.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      responsive: ['xl'],
      render: (createdAt: string) => date(createdAt),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
        </span>
      ),
    },
  ];
}
