'use client';
import { Button } from 'antd';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { signOut } from '@/lib/auth/client';
import { IconBadge } from './IconBadge';

interface LogoutButtonProps {
  collapsed?: boolean;
  iconOnly?: boolean;
}

export function LogoutButton({ collapsed = false, iconOnly = false }: LogoutButtonProps) {
  const { t } = useTranslation('admin');
  const router = useRouter();

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  if (iconOnly) {
    return (
      <Button
        type="text"
        danger
        icon={<IconBadge icon={LogOut} className="bg-salmon/20 text-error" />}
        onClick={onLogout}
        aria-label={t('common.logout')}
      />
    );
  }

  return (
    <Button
      block
      icon={<LogOut size={18} />}
      onClick={onLogout}
      title={collapsed ? t('common.logout') : undefined}
      className={collapsed ? undefined : 'justify-start!'}
    >
      {!collapsed && t('common.logout')}
    </Button>
  );
}
