'use client';
import { Card, Flex, Tag, Typography } from 'antd';
import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { RoleTag } from '@/components/shared/RoleTag';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useUserRowActions } from '../hooks/useUserRowActions';
import type { User } from '../types';

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onPasswordSetupLink: (
    url: string,
    name: string,
    email: string,
    reason: 'create' | 'reset',
  ) => void;
}

export function UserCard({ user, onEdit, onDelete, onPasswordSetupLink }: UserCardProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const rowActions = useUserRowActions({ onEdit, onDelete, onPasswordSetupLink });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <AvatarUser name={user.name} email={user.email} />
        <DataTableRowActions actions={rowActions(user)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <RoleTag role={user.role} />
        {user.mustChangePassword ? <Tag color="orange">{t('pending.badge')}</Tag> : null}
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
