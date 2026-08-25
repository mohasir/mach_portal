'use client';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { ROLES, type RoleType } from '@repo/guards';

const ROLE_COLORS: Record<RoleType, string> = {
  [ROLES.SUPERADMIN]: 'gold',
  [ROLES.ADMIN]: 'geekblue',
  [ROLES.MANAGER]: 'purple',
  [ROLES.MEMBER]: 'cyan',
};

export function RoleTag({ role, className }: { role?: string | null; className?: string }) {
  const { t } = useTranslation('users');

  if (!role) return null;

  return (
    <Tag color={ROLE_COLORS[role as RoleType] ?? 'default'} className={className}>
      {t(`roles.${role}`, role)}
    </Tag>
  );
}
