'use client';
import { Layout } from 'antd';
import { AppSidebar } from '@/components/shared/Sidebar';
import { Topbar } from '@/components/shared/Topbar';
import { useLayoutMode } from '@/lib/navigation';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { WrapperCard } from '../shared/WrapperCard';

export function AdminLayoutDesktop({ children }: { children: React.ReactNode }) {
  const layoutMode = useLayoutMode();
  const fillViewport = useLayoutStore((s) => s.fillViewport);
  const toggleSidebarCollapsed = useLayoutStore((s) => s.toggleSidebarCollapsed);

  return (
    <Layout hasSider className="bg-background h-screen overflow-hidden">
      <AppSidebar />
      <Layout className="h-screen overflow-hidden">
        <Layout.Header className="flex h-16 items-center">
          <Topbar onToggleSidebar={toggleSidebarCollapsed} />
        </Layout.Header>

        <Layout.Content
          className={`flex-1 px-4 ${fillViewport ? 'overflow-hidden pb-0' : 'overflow-y-auto pb-6'}`}
        >
          {layoutMode === 'bare' ? (
            <div>{children}</div>
          ) : (
            <WrapperCard
              className={
                fillViewport
                  ? 'flex h-full flex-col overflow-hidden rounded-t-2xl! rounded-b-none!'
                  : 'min-h-full rounded-2xl!'
              }
              classNames={{
                body: fillViewport
                  ? 'flex min-h-0 flex-1 flex-col overflow-hidden pt-4 px-4 pb-0 md:pt-8 md:px-8'
                  : 'p-4 md:p-8',
              }}
            >
              {children}
            </WrapperCard>
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
