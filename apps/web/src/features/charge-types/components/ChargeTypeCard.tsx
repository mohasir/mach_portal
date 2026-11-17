'use client';
import { Card, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { formatChargeValue } from '../helpers';
import { useChargeTypeRowActions } from '../hooks/useChargeTypeRowActions';
import type { ChargeType } from '../types';
import { ChargeTypeTags } from './ChargeTypeTags';

interface ChargeTypeCardProps {
  type: ChargeType;
  onEdit: (type: ChargeType) => void;
  onToggleActive: (type: ChargeType) => void;
}

export function ChargeTypeCard({ type, onEdit, onToggleActive }: ChargeTypeCardProps) {
  const { t } = useTranslation('chargeTypes');
  const { t: tc } = useTranslation('common');
  const { money } = useMoneyFormatter();
  const rowActions = useChargeTypeRowActions({ onEdit, onToggleActive });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Typography.Text strong className="text-base">
            {type.name}
          </Typography.Text>
          <Typography.Text type="secondary" className="text-sm">
            {t(`kinds.${type.kind}`)} · {formatChargeValue(type, money)}
          </Typography.Text>
        </div>
        <DataTableRowActions actions={rowActions(type)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <ChargeTypeTags type={type} />
      </Flex>
    </Card>
  );
}
