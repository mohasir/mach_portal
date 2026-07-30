'use client';
import { Layout } from 'antd';
import { BottomNav } from '@/components/shared/BottomNav';
import { MobileTopbar } from '@/components/shared/Topbar';
import { useLayoutStore } from '@/lib/stores/layout.store';

export function AdminLayoutMobile({ children }: { children: React.ReactNode }) {
  const fillViewport = useLayoutStore((s) => s.fillViewport);
  const contentBg = useLayoutStore((s) => s.contentBg);

  return (
    <Layout
      className={`h-dvh overflow-hidden ${contentBg === 'grey' ? 'bg-background' : 'bg-white'}`}
    >
      <Layout.Header className="shadow-xs flex h-auto min-h-16 items-center pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] px-4 leading-normal bg-white">
        <MobileTopbar />
      </Layout.Header>

      <Layout.Content
        className={`flex-1 px-4 pt-4 ${fillViewport ? 'overflow-hidden pb-0' : 'overflow-y-auto pb-6'}`}
      >
        <div>{children}</div>
      </Layout.Content>

      <BottomNav />
    </Layout>
  );
}
