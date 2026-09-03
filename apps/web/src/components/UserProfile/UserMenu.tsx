'use client';
import { Dropdown, Flex, Typography, type MenuProps } from 'antd';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { signOut, useSession } from '@/lib/auth/client';

export function UserMenu() {
  const { t } = useTranslation('admin');
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const items: MenuProps['items'] = [
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
        <Typography.Text className="text-brown hidden font-medium md:inline">
          {user?.name ?? user?.email}
        </Typography.Text>
      </Flex>
    </Dropdown>
  );
}
