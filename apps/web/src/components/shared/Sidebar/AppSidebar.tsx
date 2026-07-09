'use client';
import { Layout } from 'antd';
import { SidebarContent } from './SidebarContent';

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
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
