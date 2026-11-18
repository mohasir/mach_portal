'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { RowActionItem } from '@/components/shared/DataTable';
import type { ConsoleOrganizationRow } from '../types';

export function useOrganizationRowActions({
  onView,
}: {
  onView: (row: ConsoleOrganizationRow) => void;
}) {
  const { t } = useTranslation('console');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  return (row: ConsoleOrganizationRow): RowActionItem[] => [
    { key: 'detail', label: t('organizations.view'), onClick: () => onView(row) },
    { type: 'divider' },
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(row.id);
        message.success(tc('table.copied'));
      },
    },
  ];
}
