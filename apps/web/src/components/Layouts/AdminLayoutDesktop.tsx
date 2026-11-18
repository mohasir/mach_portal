'use client';
import { Layout } from 'antd';
import { AppSidebar } from '@/components/shared/Sidebar';
import { Topbar } from '@/components/shared/Topbar';
import { useLayoutMode } from '@/lib/navigation';
import { useLayoutStore } from '@/lib/stores/layout.store';

export function AdminLayoutDesktop({ children }: { children: React.ReactNode }) {
  const layoutMode = useLayoutMode();
  const fillViewport = useLayoutStore((s) => s.fillViewport);
  const toggleSidebarCollapsed = useLayoutStore((s) => s.toggleSidebarCollapsed);

  return (
    <Layout hasSider className="h-full overflow-hidden bg-white">
      <AppSidebar />
      <Layout className="h-full overflow-hidden bg-white">
        <Layout.Header className="flex h-16 items-center px-8">
          <Topbar onToggleSidebar={toggleSidebarCollapsed} />
        </Layout.Header>

        <Layout.Content
          className={`flex-1 px-8 ${fillViewport ? 'overflow-hidden pb-0' : 'overflow-y-auto pb-6'}`}
        >
          {layoutMode === 'bare' ? (
            <div>{children}</div>
          ) : (
            <div
              className={
                fillViewport
                  ? 'flex h-full min-h-0 flex-col overflow-hidden pt-4 pb-0 md:pt-8'
                  : 'min-h-full py-4 md:py-8'
              }
            >
              {children}
            </div>
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
