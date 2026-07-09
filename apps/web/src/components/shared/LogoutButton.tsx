'use client';
import { Button } from 'antd';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { signOut } from '@/lib/auth/client';

export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation('admin');
  const router = useRouter();

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

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
