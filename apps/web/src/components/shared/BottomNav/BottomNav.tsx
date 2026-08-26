'use client';
import { Button } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { IconMap, NAV_BOTTOM_MENU, type NavItem } from '@/lib/navigation';

export function BottomNav() {
  const { t } = useTranslation('admin');
  const can = useCan();
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const canCreateQuote = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });

  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const renderTab = (item: NavItem) => {
    if (item.guard && !can(item.guard)) return null;
    const active = isActive(item.href!);
    return (
      <button
        key={item.href}
        onClick={() => router.push(item.href!)}
        className={`flex flex-1 flex-col items-center gap-0.5 px-1 py-4 ${active ? 'text-primary font-semibold' : 'text-muted'}`}
      >
        {IconMap[item.icon!]}
        <span className="text-xs">{t(item.label)}</span>
      </button>
    );
  };

  return (
    <nav className="border-line bg-surface flex border-t px-4 pb-[env(safe-area-inset-bottom)]">
      {NAV_BOTTOM_MENU.leftItems.map(renderTab)}

      {canCreateQuote && (
        <div className="-mt-5 flex flex-1 items-start justify-center">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<Plus size={28} />}
            onClick={() => router.push('/admin/quotes/new')}
            aria-label={t('nav.newQuote')}
            className="shadow-lg"
          />
        </div>
      )}

      {NAV_BOTTOM_MENU.rightItems.map(renderTab)}
    </nav>
  );
}
