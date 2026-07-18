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
      className="flex h-22 justify-center items-center transition-opacity hover:opacity-80 py-2"
      style={{
        margin: !collapsed ? '1rem .5rem 1rem .5rem' : '0',
      }}
    >
      <Logo iconOnly={collapsed} />
    </Link>
  );
}
