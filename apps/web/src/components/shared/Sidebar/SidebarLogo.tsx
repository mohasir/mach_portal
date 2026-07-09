import { Logo } from '@/components/shared/Logo';

export function SidebarLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={`flex h-16 items-center ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
      <Logo iconOnly={collapsed} />
    </div>
  );
}
