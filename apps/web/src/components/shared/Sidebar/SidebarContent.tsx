'use client';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import { SidebarLogo } from './SidebarLogo';
import { SidebarNav } from './SidebarNav';

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  return (
    <div className="bg-surface flex h-full flex-col">
      <SidebarLogo collapsed={collapsed} onNavigate={onNavigate} />

      <OverlayScrollbarsComponent
        className="min-h-0 flex-1 px-3 py-2"
        options={{
          overflow: { x: 'hidden' },
          scrollbars: { autoHide: 'leave', theme: 'os-theme-dark' },
        }}
        defer
      >
        <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
      </OverlayScrollbarsComponent>
    </div>
  );
}
