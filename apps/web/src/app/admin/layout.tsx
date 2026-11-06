import { AdminLayoutContainer } from '@/components/Layouts';
import { TenantGate } from '@/features/tenant';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantGate>
      <AdminLayoutContainer>{children}</AdminLayoutContainer>
    </TenantGate>
  );
}
