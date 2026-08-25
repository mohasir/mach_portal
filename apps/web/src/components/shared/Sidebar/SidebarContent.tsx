'use client';
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

      <div className={`flex-1 overflow-y-auto py-2 px-3`}>
        <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
