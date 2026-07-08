'use client';
import { Button, Flex, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { signOut } from '@/lib/auth/client';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
  const router = useRouter();

  const onLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="border-line bg-surface border-b">
        <Flex justify="space-between" align="center" className="mx-auto h-14 max-w-4xl px-6">
          <Typography.Text strong className="font-heading text-brown">
            {t('appName')}
          </Typography.Text>
          <Button size="small" onClick={onLogout}>
            {t('logout')}
          </Button>
        </Flex>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
