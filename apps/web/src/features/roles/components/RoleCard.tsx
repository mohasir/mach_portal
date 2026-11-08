'use client';
import { Card, Flex, Tag, Typography } from 'antd';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useRoleRowActions } from '../hooks/useRoleRowActions';
import { OwnerRoleTag } from './OwnerRoleTag';
import type { Role } from '../types';

interface RoleCardProps {
  role: Role;
  onOpen: (role: Role) => void;
  onDuplicate: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function RoleCard({ role, onOpen, onDuplicate, onDelete }: RoleCardProps) {
  const { t } = useTranslation('roles');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useRoleRowActions({ onOpen, onDuplicate, onDelete });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Typography.Text strong className="min-w-0 text-base wrap-break-word">
          {role.name}
        </Typography.Text>
        <DataTableRowActions actions={rowActions(role)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        {role.isOwner && <OwnerRoleTag />}
        <Tag
          color={role.memberCount > 0 ? 'blue' : 'default'}
          icon={<Users size={14} />}
          className="m-0 inline-flex items-center gap-1"
        >
          {t('members', { count: role.memberCount })}
        </Tag>
      </Flex>

      <Typography.Text type="secondary" className="mt-3 block text-xs">
        {t('columns.updatedAt')}: {date(role.updatedAt)}
      </Typography.Text>
    </Card>
  );
}
