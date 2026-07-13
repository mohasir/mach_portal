'use client';
import { Card, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useEventTypeRowActions } from '../hooks/useEventTypeRowActions';
import type { EventType } from '../types';

interface EventTypeCardProps {
  eventType: EventType;
  onEdit: (eventType: EventType) => void;
  onToggleActive: (eventType: EventType) => void;
}

export function EventTypeCard({ eventType, onEdit, onToggleActive }: EventTypeCardProps) {
  const { t } = useTranslation('eventTypes');
  const { t: tc } = useTranslation('common');
  const rowActions = useEventTypeRowActions({ onEdit });

  return (
    <Card size="small">
      <div className="flex items-center justify-between gap-3">
        <Typography.Text strong>{eventType.name}</Typography.Text>
        <DataTableRowActions actions={rowActions(eventType)} label={tc('table.actions')} />
      </div>
    </Card>
  );
}
