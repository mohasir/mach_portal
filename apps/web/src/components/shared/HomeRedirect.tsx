'use client';
import { useEffect } from 'react';
import { Flex, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/client';
import { resolveHomeTarget } from '@/lib/auth/navigation';

/** Sends each user to their landing area once the session resolves. */
export function HomeRedirect() {
  const router = useRouter();
  const { data, isPending } = useSession();
  const target = resolveHomeTarget({
    isPending,
    user: (data?.user as { isPlatformAdmin?: boolean | null } | undefined) ?? null,
  });
  const to = typeof target === 'object' ? target.redirect : null;

  useEffect(() => {
    if (to) router.replace(to);
  }, [to, router]);

  return (
    <Flex justify="center" align="center" className="min-h-dvh">
      <Spin />
    </Flex>
  );
}
