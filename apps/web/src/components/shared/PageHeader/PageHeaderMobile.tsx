'use client';
import { useEffect, type ReactNode } from 'react';
import { usePageHeaderStore, type MobilePageHeaderAction } from '@/lib/stores/pageHeader.store';

interface PageHeaderMobileProps {
  title: ReactNode;
  titleSuffix?: ReactNode;
  onBack?: () => void;
  showLogout?: boolean;
  action?: MobilePageHeaderAction;
}

export function PageHeaderMobile({
  title,
  titleSuffix,
  onBack,
  showLogout,
  action,
}: PageHeaderMobileProps) {
  const setHeader = usePageHeaderStore((s) => s.setHeader);
  const clearHeader = usePageHeaderStore((s) => s.clearHeader);

  useEffect(() => {
    setHeader({ title, titleSuffix, onBack, showLogout, action });
    return () => clearHeader();
  }, [title, titleSuffix, onBack, showLogout, action, setHeader, clearHeader]);

  return null;
}
