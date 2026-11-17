'use client';
import { type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { formatChargeValue } from '../helpers';
import { useChargeTypeRowActions } from '../hooks/useChargeTypeRowActions';
import type { ChargeType } from '../types';
import { ChargeTypeTags } from './ChargeTypeTags';

interface UseChargeTypesColumnsParams {
  onEdit: (type: ChargeType) => void;
  onToggleActive: (type: ChargeType) => void;
}

export function useChargeTypesColumns({
  onEdit,
  onToggleActive,
}: UseChargeTypesColumnsParams): TableColumnsType<ChargeType> {
  const { t } = useTranslation('chargeTypes');
  const { t: tc } = useTranslation('common');
  const { money } = useMoneyFormatter();
  const rowActions = useChargeTypeRowActions({ onEdit, onToggleActive });

  return [
    { title: t('columns.name'), dataIndex: 'name', key: 'name', sorter: true },
    {
      title: t('columns.kind'),
      dataIndex: 'kind',
      key: 'kind',
      sorter: true,
      render: (kind: ChargeType['kind']) => t(`kinds.${kind}`),
    },
    {
      title: t('columns.defaultValue'),
      key: 'defaultValue',
      responsive: ['sm'],
      render: (_, type) => formatChargeValue(type, money),
    },
    {
      title: t('columns.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      sorter: true,
      responsive: ['sm'],
      render: (_, type) => <ChargeTypeTags type={type} />,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, type) => (
        <DataTableRowActions actions={rowActions(type)} label={tc('table.actions')} />
      ),
    },
  ];
}
