'use client';
import { env } from '@/env';
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

      {!collapsed && (
        <div className="flex flex-col gap-0.5 px-3 py-3 text-center">
          <span className="text-caption text-muted">
            v{env.NEXT_PUBLIC_APP_VERSION} · {env.NEXT_PUBLIC_APP_COMMIT}
          </span>
          <span className="text-caption text-muted">
            © {new Date().getFullYear()} Oravitech, todos los derechos reservados
          </span>
        </div>
      )}
    </div>
  );
}
