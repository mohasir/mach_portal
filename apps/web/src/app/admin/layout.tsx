import { AdminLayoutContainer } from '@/components/Layouts';
import { TenantGate } from '@/features/tenant';
import { RouteGuard } from '@/lib/auth/RouteGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantGate>
      <AdminLayoutContainer>
        <RouteGuard>{children}</RouteGuard>
      </AdminLayoutContainer>
    </TenantGate>
  );
}
