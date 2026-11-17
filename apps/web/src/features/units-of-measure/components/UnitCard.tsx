'use client';
import { Card, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { factorLabel } from '../helpers';
import { useUnitRowActions } from '../hooks/useUnitRowActions';
import type { UnitOfMeasure } from '../types';
import { UnitTags } from './UnitTags';

interface UnitCardProps {
  unit: UnitOfMeasure;
  onEdit: (unit: UnitOfMeasure) => void;
  onToggleActive: (unit: UnitOfMeasure) => void;
}

export function UnitCard({ unit, onEdit, onToggleActive }: UnitCardProps) {
  const { t } = useTranslation('unitsOfMeasure');
  const { t: tc } = useTranslation('common');
  const rowActions = useUnitRowActions({ onEdit, onToggleActive });
  const factor = factorLabel(unit);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Typography.Text strong className="text-base">
            {unit.name} <Typography.Text type="secondary">({unit.code})</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary" className="text-sm">
            {t(`dimensions.${unit.dimension}`)}
            {factor && ` · ${t('columns.factor')} ${factor}`}
          </Typography.Text>
        </div>
        <DataTableRowActions actions={rowActions(unit)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <UnitTags unit={unit} />
      </Flex>
    </Card>
  );
}
