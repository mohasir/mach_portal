'use client';
import { useState } from 'react';
import { Avatar, Button, Flex, Typography } from 'antd';
import { ArrowLeft, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconBadge } from '@/components/shared/IconBadge';
import { LogoutButton } from '@/components/shared/LogoutButton';
import { RoleTag } from '@/components/shared/RoleTag';
import { UserDrawer } from '@/components/UserProfile';
import { useSession } from '@/lib/auth/client';
import { usePageHeaderStore } from '@/lib/stores/pageHeader.store';

export function MobileTopbar() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation('common');
  const { data } = useSession();
  const user = data?.user;
  const role = (user as { role?: string | null } | undefined)?.role;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const header = usePageHeaderStore((s) => s.header);

  return (
    <>
      <Flex align="center" justify="space-between" gap={16} className="w-full">
        {header ? (
          <Flex align="center" gap={4} className="min-w-0">
            {header.onBack && (
              <Button
                type="text"
                icon={<ArrowLeft size={18} />}
                onClick={header.onBack}
                aria-label={tc('back')}
              />
            )}
            <Typography.Title level={3} className="font-heading text-brown m-0! min-w-0 truncate">
              {header.title}
            </Typography.Title>
          </Flex>
        ) : (
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
        )}

        <Flex align="center" gap={4}>
          {header?.action && (
            <Button
              type="text"
              icon={<IconBadge icon={header.action.icon} />}
              onClick={header.action.onClick}
              aria-label={header.action.ariaLabel}
            />
          )}
          {header?.showLogout && <LogoutButton iconOnly />}
        </Flex>
      </Flex>

      <UserDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
