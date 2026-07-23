'use client';
import { Button, Drawer } from 'antd';
import { useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { RoleTag } from '@/components/shared/RoleTag';
import { env } from '@/env';
import { signOut, useSession } from '@/lib/auth/client';

export function UserDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;
  const role = (user as { role?: string | null } | undefined)?.role;

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const onSettings = () => {
    onClose();
    router.push('/admin/settings');
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={300}
      title={null}
      closable={false}
    >
      <div className="flex h-full flex-col gap-6">
        <AvatarUser
          name={user?.name ?? ''}
          email={user?.email}
          size={56}
          extra={<RoleTag role={role} className="mt-1" />}
        />

        <div className="flex flex-col gap-1">
          <LanguageSwitcher block className="justify-start" />
          <Button
            type="text"
            block
            icon={<Settings size={16} />}
            onClick={onSettings}
            className="justify-start"
          >
            {t('nav.settings')}
          </Button>
          <Button
            type="text"
            danger
            block
            icon={<LogOut size={16} />}
            onClick={onLogout}
            className="justify-start"
          >
            {t('common.logout')}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
