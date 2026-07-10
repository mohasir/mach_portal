import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';
import { DEFAULT_REDIRECT_HOME } from '@/lib/auth/navigation';

interface SidebarLogoProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarLogo({ collapsed = false, onNavigate }: SidebarLogoProps) {
  return (
    <Link
      href={DEFAULT_REDIRECT_HOME}
      onClick={onNavigate}
      className={`flex h-16 items-center transition-opacity hover:opacity-80 ${collapsed ? 'justify-center px-0' : 'px-4'}`}
    >
      <Logo iconOnly={collapsed} />
    </Link>
  );
}
