'use client';
import { Layout } from 'antd';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { SidebarContent } from './SidebarContent';

export function AppSidebar() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);

  return (
    <Layout.Sider
      theme="light"
      width={248}
      collapsedWidth={80}
      collapsed={collapsed}
      trigger={null}
      className="border-line h-full border-r"
    >
      <SidebarContent collapsed={collapsed} />
    </Layout.Sider>
  );
}
