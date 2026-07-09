'use client';
import { Menu, Skeleton } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/lib/auth/useCan';
import { useNavigation } from '@/lib/navigation';
import { buildMenuItems, findActiveKey } from './helpers';

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
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

  const items = buildMenuItems(menu, can, t);
  const activeKey = findActiveKey(menu, pathname ?? '');

  return (
    <Menu
      mode="inline"
      theme="light"
      items={items}
      selectedKeys={activeKey ? [activeKey] : []}
      onClick={({ key }) => {
        if (key.startsWith('/')) router.push(key);
        onNavigate?.();
      }}
      className="border-none! bg-transparent!"
    />
  );
}
