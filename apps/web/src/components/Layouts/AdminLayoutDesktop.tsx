'use client';
import { Layout } from 'antd';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { AppSidebar } from '@/components/shared/Sidebar';
import { Topbar } from '@/components/shared/Topbar';
import { useLayoutMode } from '@/lib/navigation';
import { useLayoutStore } from '@/lib/stores/layout.store';

export function AdminLayoutDesktop({ children }: { children: React.ReactNode }) {
  const layoutMode = useLayoutMode();
  const fillViewport = useLayoutStore((s) => s.fillViewport);
  const toggleSidebarCollapsed = useLayoutStore((s) => s.toggleSidebarCollapsed);

  const content =
    layoutMode === 'bare' ? (
      <div className="pt-4 md:pt-8">{children}</div>
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
    );

  return (
    <Layout hasSider className="h-full overflow-hidden bg-white">
      <AppSidebar />
      <Layout className="h-full overflow-hidden bg-white">
        <Layout.Header className="border-line flex h-16 items-center border-b px-8">
          <Topbar onToggleSidebar={toggleSidebarCollapsed} />
        </Layout.Header>

        <Layout.Content className="min-h-0 flex-1 overflow-hidden">
          {fillViewport ? (
            <div className="h-full px-8">{content}</div>
          ) : (
            <OverlayScrollbarsComponent
              className="h-full"
              options={{
                overflow: { x: 'hidden' },
                scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' },
              }}
              defer
            >
              <div className="px-8 pb-6">{content}</div>
            </OverlayScrollbarsComponent>
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
