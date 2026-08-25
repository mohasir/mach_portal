'use client';
import type { ReactNode } from 'react';
import type { PermissionCheck } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';

interface CanProps {
  allowed: PermissionCheck;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renderiza `children` solo si la sesión tiene los permisos; si no, `fallback`. */
export function Can({ allowed, fallback = null, children }: CanProps) {
  const can = useCan();
  return <>{can(allowed) ? children : fallback}</>;
}
