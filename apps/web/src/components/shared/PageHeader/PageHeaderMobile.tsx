'use client';
import { useEffect, type ReactNode } from 'react';
import { usePageHeaderStore, type MobilePageHeaderAction } from '@/lib/stores/pageHeader.store';

interface PageHeaderMobileProps {
  title: ReactNode;
  onBack?: () => void;
  showLogout?: boolean;
  action?: MobilePageHeaderAction;
}

export function PageHeaderMobile({ title, onBack, showLogout, action }: PageHeaderMobileProps) {
  const setHeader = usePageHeaderStore((s) => s.setHeader);
  const clearHeader = usePageHeaderStore((s) => s.clearHeader);

  useEffect(() => {
    setHeader({ title, onBack, showLogout, action });
    return () => clearHeader();
  }, [title, onBack, showLogout, action, setHeader, clearHeader]);

  return null;
}
