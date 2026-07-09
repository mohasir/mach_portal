'use client';
import { SessionGuard } from '@/features/auth';
import { AdminLayoutContainer } from '@/components/Layouts';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <AdminLayoutContainer>{children}</AdminLayoutContainer>
    </SessionGuard>
  );
}
