import { ConsoleGuard, ConsoleLayout } from '@/features/console';

export default function ConsoleRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleGuard>
      <ConsoleLayout>{children}</ConsoleLayout>
    </ConsoleGuard>
  );
}
