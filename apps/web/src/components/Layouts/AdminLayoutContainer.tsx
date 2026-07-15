'use client';
import { useState } from 'react';
import { Card, Drawer, Layout } from 'antd';
import { AppSidebar, SidebarContent } from '@/components/shared/Sidebar';
import { Topbar } from '@/components/shared/Topbar';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useLayoutMode } from '@/lib/navigation';

export function AdminLayoutContainer({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  const layoutMode = useLayoutMode();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const onToggleSidebar = () =>
    isDesktop ? setCollapsed((c) => !c) : setMobileOpen((o) => !o);

  return (
    <Layout hasSider className="bg-background h-screen overflow-hidden">
      {isDesktop ? (
        <AppSidebar collapsed={collapsed} />
      ) : (
        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          size={248}
          closable={false}
          classNames={{ body: 'p-0!' }}
        >
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <Layout className="h-screen overflow-hidden">
        <Layout.Header className="flex h-16 items-center">
          <Topbar onToggleSidebar={onToggleSidebar} />
        </Layout.Header>

        <Layout.Content className="flex-1 overflow-y-auto px-4 pb-6">
          {layoutMode === 'bare' ? (
            <div className="p-4 md:p-8">{children}</div>
          ) : (
            <Card className="min-h-full rounded-2xl!" classNames={{ body: 'p-4 md:p-8' }}>
              {children}
            </Card>
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
