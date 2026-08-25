'use client';
import { Menu, Skeleton } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/lib/auth/useCan';
import { useNavigation } from '@/lib/navigation';
import { buildMenuItems, findActiveKey } from './helpers';
import { NewQuoteButton } from './NewQuoteButton';

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation('admin');
  const can = useCan();
  const pathname = usePathname();
  const router = useRouter();
  const { menu, isLoading } = useNavigation();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-3 py-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton.Button key={i} active block className="h-10!" />
        ))}
      </div>
    );
  }

  const items = buildMenuItems(menu, can, t, collapsed) ?? [];
  const activeKey = findActiveKey(menu, pathname ?? '');

  const onClick = ({ key }: { key: string }) => {
    if (key.startsWith('/')) router.push(key);
    onNavigate?.();
  };
  const menuProps = {
    mode: 'inline' as const,
    theme: 'light' as const,
    selectedKeys: activeKey ? [activeKey] : [],
    onClick,
    className: 'mach-sidebar-menu border-none! bg-transparent!',
  };

  return (
    <>
      <Menu {...menuProps} items={items.slice(0, 1)} />
      <NewQuoteButton collapsed={collapsed} onNavigate={onNavigate} />
      <Menu {...menuProps} items={items.slice(1)} />
    </>
  );
}
