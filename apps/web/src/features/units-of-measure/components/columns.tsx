'use client';
import { Flex, Typography, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { factorLabel } from '../helpers';
import { useUnitRowActions } from '../hooks/useUnitRowActions';
import type { UnitOfMeasure } from '../types';
import { UnitTags } from './UnitTags';

interface UseUnitsColumnsParams {
  onEdit: (unit: UnitOfMeasure) => void;
  onToggleActive: (unit: UnitOfMeasure) => void;
}

export function useUnitsColumns({
  onEdit,
  onToggleActive,
}: UseUnitsColumnsParams): TableColumnsType<UnitOfMeasure> {
  const { t } = useTranslation('unitsOfMeasure');
  const { t: tc } = useTranslation('common');
  const rowActions = useUnitRowActions({ onEdit, onToggleActive });

  return [
    {
      title: t('columns.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (_, unit) => (
        <Flex vertical>
          <Typography.Text>{unit.name}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {unit.pluralName}
          </Typography.Text>
        </Flex>
      ),
    },
    { title: t('columns.code'), dataIndex: 'code', key: 'code', sorter: true },
    {
      title: t('columns.dimension'),
      dataIndex: 'dimension',
      key: 'dimension',
      sorter: true,
      render: (dimension: UnitOfMeasure['dimension']) => t(`dimensions.${dimension}`),
    },
    {
      title: t('columns.factor'),
      key: 'factor',
      responsive: ['md'],
      render: (_, unit) => factorLabel(unit) ?? '—',
    },
    {
      title: t('columns.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      sorter: true,
      responsive: ['sm'],
      render: (_, unit) => (
        <Flex wrap gap={4}>
          <UnitTags unit={unit} />
        </Flex>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, unit) => (
        <DataTableRowActions actions={rowActions(unit)} label={tc('table.actions')} />
      ),
    },
  ];
}
