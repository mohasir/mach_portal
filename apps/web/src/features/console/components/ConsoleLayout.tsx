'use client';
import { Button, Layout, Menu, type MenuProps } from 'antd';
import { Building2, LayoutDashboard, LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/shared/Logo';
import { UserMenu } from '@/components/UserProfile';
import { CONSOLE_ROUTE, SELECT_ORGANIZATION_ROUTE } from '@/lib/auth/navigation';

const ORGANIZATIONS_ROUTE = `${CONSOLE_ROUTE}/organizations`;

export function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('console');
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const items: MenuProps['items'] = [
    { key: CONSOLE_ROUTE, icon: <LayoutDashboard size={16} />, label: t('nav.home') },
    { key: ORGANIZATIONS_ROUTE, icon: <Building2 size={16} />, label: t('nav.organizations') },
  ];
  const selected = pathname.startsWith(ORGANIZATIONS_ROUTE) ? ORGANIZATIONS_ROUTE : CONSOLE_ROUTE;

  return (
    <Layout className="min-h-dvh bg-background">
      <Layout.Header className="bg-surface border-line sticky top-0 z-10 flex h-auto flex-col gap-1 border-b px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-0 leading-normal">
        <div className="flex w-full items-center justify-between gap-4">
          <Link href={CONSOLE_ROUTE} className="block h-8 w-36 shrink-0">
            <Logo />
          </Link>
          <UserMenu />
        </div>
        <div className="flex w-full items-center justify-between gap-2">
          <Menu
            mode="horizontal"
            items={items}
            selectedKeys={[selected]}
            onClick={({ key }) => router.push(key)}
            aria-label={t('nav.label')}
            className="min-w-0 flex-1 border-b-0 bg-transparent"
          />
          <Button
            type="text"
            icon={<LogIn size={16} />}
            aria-label={t('nav.enterOrganization')}
            onClick={() => router.push(SELECT_ORGANIZATION_ROUTE)}
          >
            <span className="hidden sm:inline">{t('nav.enterOrganization')}</span>
          </Button>
        </div>
      </Layout.Header>
      <Layout.Content className="mx-auto w-full max-w-6xl px-4 py-4 md:py-6">
        {children}
      </Layout.Content>
    </Layout>
  );
}
