'use client';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { describeRole, roleLabel, type RoleIdentity } from '@/lib/auth/roleLabel';

export function RoleTag({ role, className }: { role?: RoleIdentity | null; className?: string }) {
  const { t } = useTranslation('users');

  if (!role) return null;

  return (
    <Tag color={describeRole(role).color} className={className}>
      {roleLabel(role, t)}
    </Tag>
  );
}
