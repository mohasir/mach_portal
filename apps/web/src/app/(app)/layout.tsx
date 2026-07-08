'use client';
import { useEffect } from 'react';
import { Flex, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/client';
import { AppShell } from '@/components/layout/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) router.replace('/login');
  }, [isPending, session, router]);

  if (isPending || !session) {
    return (
      <Flex justify="center" align="center" className="min-h-screen">
        <Spin />
      </Flex>
    );
  }

  return <AppShell>{children}</AppShell>;
}
