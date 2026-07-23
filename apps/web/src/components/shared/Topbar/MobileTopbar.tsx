'use client';
import { useState } from 'react';
import { Avatar, Flex, Typography } from 'antd';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { RoleTag } from '@/components/shared/RoleTag';
import { UserDrawer } from '@/components/UserProfile';
import { useSession } from '@/lib/auth/client';

export function MobileTopbar() {
  const { t } = useTranslation('admin');
  const { data } = useSession();
  const user = data?.user;
  const role = (user as { role?: string | null } | undefined)?.role;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Flex align="center" justify="space-between" gap={16} className="w-full">
        <Flex
          align="center"
          gap={10}
          className="min-w-0 cursor-pointer"
          onClick={() => setDrawerOpen(true)}
        >
          <Avatar src={user?.image ?? undefined} icon={<User size={16} />} />
          <div className="min-w-0">
            <Typography.Text className="text-brown block truncate text-sm font-medium">
              {t('topbar.greeting', { name: user?.name ?? user?.email ?? '' })}
            </Typography.Text>
            <RoleTag role={role} />
          </div>
        </Flex>

        <LanguageSwitcher />
      </Flex>

      <UserDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
