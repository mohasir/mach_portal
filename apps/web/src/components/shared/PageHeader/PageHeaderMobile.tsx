'use client';
import { useEffect, type ReactNode } from 'react';
import { usePageHeaderStore, type MobilePageHeaderAction } from '@/lib/stores/pageHeader.store';

interface PageHeaderMobileProps {
  title: ReactNode;
  titleSuffix?: ReactNode;
  onBack?: () => void;
  showLogout?: boolean;
  action?: MobilePageHeaderAction;
  titleSize?: 'default' | 'sm';
}

export function PageHeaderMobile({
  title,
  titleSuffix,
  onBack,
  showLogout,
  action,
  titleSize,
}: PageHeaderMobileProps) {
  const setHeader = usePageHeaderStore((s) => s.setHeader);
  const clearHeader = usePageHeaderStore((s) => s.clearHeader);

  useEffect(() => {
    setHeader({ title, titleSuffix, onBack, showLogout, action, titleSize });
    return () => clearHeader();
  }, [title, titleSuffix, onBack, showLogout, action, titleSize, setHeader, clearHeader]);

  return null;
}
