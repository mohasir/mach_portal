'use client';
import { Dropdown, Flex, Typography, type MenuProps } from 'antd';
import { ArrowLeftRight, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useCanSwitchTenant, useSignOut } from '@/features/tenant';
import { useSession } from '@/lib/auth/client';
import { SELECT_ORGANIZATION_ROUTE } from '@/lib/auth/navigation';

export function UserMenu() {
  const { t } = useTranslation('admin');
  const { t: tt } = useTranslation('tenant');
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;
  const canSwitchTenant = useCanSwitchTenant();

  const onLogout = useSignOut();

  const items: MenuProps['items'] = [
    ...(canSwitchTenant
      ? [
          {
            key: 'switchTenant',
            icon: <ArrowLeftRight size={16} />,
            label: tt('menu.switch'),
            onClick: () => router.push(SELECT_ORGANIZATION_ROUTE),
          },
        ]
      : []),
    {
      key: 'logout',
      icon: <LogOut size={16} />,
      label: t('common.logout'),
      onClick: onLogout,
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <Flex align="center" gap={8} className="cursor-pointer">
        <AvatarUser
          name={user?.name ?? user?.email ?? ''}
          image={user?.image}
          showDetails={false}
        />
        <Typography.Text className="text-navy hidden font-medium md:inline">
          {user?.name ?? user?.email}
        </Typography.Text>
      </Flex>
    </Dropdown>
  );
}
