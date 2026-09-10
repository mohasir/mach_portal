'use client';
import { useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PullToRefresh({ children, className, disabled }: PullToRefreshProps) {
  const queryClient = useQueryClient();
  const onRefresh = useCallback(() => queryClient.invalidateQueries(), [queryClient]);
  const { containerRef, pullDistance, pullThreshold, refreshing } = usePullToRefresh<HTMLDivElement>(
    { onRefresh, disabled },
  );

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 flex h-10 items-center justify-center"
        style={{ opacity: Math.min(pullDistance / pullThreshold, 1) }}
      >
        <RefreshCw
          size={18}
          className={`text-primary ${refreshing ? 'animate-spin' : ''}`}
          style={
            refreshing ? undefined : { transform: `rotate(${(pullDistance / pullThreshold) * 180}deg)` }
          }
        />
      </div>
      <div
        ref={containerRef}
        className={`relative z-10 ${className ?? ''}`}
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.2s ease' : undefined,
        }}
      >
        {children}
      </div>
    </>
  );
}
