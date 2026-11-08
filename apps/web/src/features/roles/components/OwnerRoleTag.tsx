'use client';
import { Tag } from 'antd';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function OwnerRoleTag() {
  const { t } = useTranslation('roles');
  return (
    <Tag
      color="gold"
      icon={<ShieldCheck size={14} />}
      className="m-0 inline-flex items-center gap-1"
    >
      {t('ownerTag')}
    </Tag>
  );
}
