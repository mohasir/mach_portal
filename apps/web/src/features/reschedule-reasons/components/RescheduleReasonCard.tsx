'use client';
import { Card, Flex, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useRescheduleReasonRowActions } from '../hooks/useRescheduleReasonRowActions';
import type { RescheduleReason } from '../types';

interface RescheduleReasonCardProps {
  reason: RescheduleReason;
  onEdit: (reason: RescheduleReason) => void;
  onToggleActive: (reason: RescheduleReason) => void;
}

export function RescheduleReasonCard({
  reason,
  onEdit,
  onToggleActive,
}: RescheduleReasonCardProps) {
  const { t } = useTranslation('rescheduleReasons');
  const { t: tc } = useTranslation('common');
  const rowActions = useRescheduleReasonRowActions({ onEdit, onToggleActive });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Typography.Text strong className="text-base">
          {reason.name}
        </Typography.Text>
        <DataTableRowActions actions={rowActions(reason)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <Tag color={reason.isActive ? 'green' : 'default'}>
          {reason.isActive ? t('status.active') : t('status.inactive')}
        </Tag>
        {reason.requiresNote && <Tag color="blue">{t('columns.requiresNote')}</Tag>}
      </Flex>
    </Card>
  );
}
