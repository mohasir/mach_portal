import { AdminLayoutContainer } from '@/components/Layouts';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutContainer>{children}</AdminLayoutContainer>;
}
