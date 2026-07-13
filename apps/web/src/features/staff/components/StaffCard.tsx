'use client';
import { Card, Flex, Tag, Typography } from 'antd';
import { Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useStaffRowActions } from '../hooks/useStaffRowActions';
import type { Staff } from '../types';

interface StaffCardProps {
  member: Staff;
  onEdit: (member: Staff) => void;
  onDelete: (member: Staff) => void;
}

export function StaffCard({ member, onEdit, onDelete }: StaffCardProps) {
  const { t } = useTranslation('staff');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useStaffRowActions({ onEdit, onDelete });

  return (
    <Card size="small">
      <div className="flex items-start justify-between gap-3">
        <AvatarUser name={member.name} email={member.email} />
        <DataTableRowActions actions={rowActions(member)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <Tag color={member.isActive ? 'green' : 'default'}>
          {t(member.isActive ? 'status.active' : 'status.inactive')}
        </Tag>
        {member.phone ? (
          <Typography.Text type="secondary" className="flex items-center gap-1 text-xs">
            <Phone size={14} />
            {member.phone}
          </Typography.Text>
        ) : null}
      </Flex>

      <Typography.Text type="secondary" className="mt-3 block text-xs">
        {t('columns.createdAt')}: {date(member.createdAt)}
      </Typography.Text>
    </Card>
  );
}
