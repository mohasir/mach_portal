'use client';
import { ReleaseNotesGate } from '@/features/release-notes';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { AdminLayoutDesktop } from './AdminLayoutDesktop';
import { AdminLayoutMobile } from './AdminLayoutMobile';

export function AdminLayoutContainer({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  return (
    <>
      {isDesktop ? (
        <AdminLayoutDesktop>{children}</AdminLayoutDesktop>
      ) : (
        <AdminLayoutMobile>{children}</AdminLayoutMobile>
      )}
      <ReleaseNotesGate />
    </>
  );
}
