'use client';
import { Card, Flex, Tag, Typography } from 'antd';
import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type RoleType } from '@repo/guards';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { ROLE_COLORS } from '../helpers';
import { useUserRowActions } from '../hooks/useUserRowActions';
import type { User } from '../types';

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useUserRowActions({ onEdit, onDelete });

  return (
    <Card size="small">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <Typography.Text strong className="text-brown block truncate">
              {user.name || '—'}
            </Typography.Text>
            <Typography.Text type="secondary" className="block truncate text-xs">
              {user.email}
            </Typography.Text>
          </div>
        </div>
        <DataTableRowActions actions={rowActions(user)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        {user.role ? (
          <Tag color={ROLE_COLORS[user.role as RoleType] ?? 'default'}>
            {t(`roles.${user.role}`, user.role)}
          </Tag>
        ) : null}
        {user.emailVerified ? (
          <Tag color="green" icon={<BadgeCheck size={14} />}>
            {t('columns.emailVerified')}
          </Tag>
        ) : null}
        <Tag color={user.sessionsCount > 0 ? 'blue' : 'default'}>
          {t('columns.sessions')}: {user.sessionsCount}
        </Tag>
      </Flex>

      <Typography.Text type="secondary" className="mt-3 block text-xs">
        {t('columns.createdAt')}: {date(user.createdAt)}
      </Typography.Text>
    </Card>
  );
}
