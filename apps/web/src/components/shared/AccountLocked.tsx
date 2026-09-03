'use client';
import { Button, Flex, Result, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { RoleTag } from '@/components/shared/RoleTag';
import { signOut, useSession } from '@/lib/auth/client';

export function AccountLocked() {
  const { t } = useTranslation('auth');
  const { t: ta } = useTranslation('admin');
  const router = useRouter();
  const { data } = useSession();
  const user = data?.user;
  const role = (user as { role?: string | null } | undefined)?.role;

  const onSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Flex
        align="center"
        gap={10}
        className="shadow-xs min-h-16 bg-white px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
      >
        <AvatarUser
          name={user?.name ?? user?.email ?? ''}
          image={user?.image}
          showDetails={false}
        />
        <div className="min-w-0">
          <Typography.Text className="text-brown block truncate text-base font-medium">
            {ta('topbar.greeting', { name: user?.name ?? user?.email ?? '' })}
          </Typography.Text>
          <RoleTag role={role} />
        </div>
      </Flex>

      <Flex justify="center" align="center" className="flex-1 p-6">
        <Result
          status="warning"
          title={t('accountLocked.title')}
          subTitle={t('accountLocked.subtitle')}
          extra={
            <Button type="primary" onClick={onSignOut}>
              {t('accountLocked.signOut')}
            </Button>
          }
        />
      </Flex>
    </div>
  );
}
