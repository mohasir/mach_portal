import { AuthLayoutContainer } from '@/components/Layouts';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutContainer>{children}</AuthLayoutContainer>;
}
