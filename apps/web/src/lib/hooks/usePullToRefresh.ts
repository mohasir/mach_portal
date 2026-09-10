'use client';
import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD = 70;
const MAX_PULL = 100;
const RESISTANCE = 2.2;

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<unknown> | void;
  disabled?: boolean;
}

// Touch-driven, since overscroll-behavior:none (globals.css) kills the browser's own
// pull-to-refresh so the installed PWA doesn't rubber-band like a website — this replaces it.
export function usePullToRefresh<T extends HTMLElement>({
  onRefresh,
  disabled,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<T>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const reset = () => {
      startYRef.current = null;
      pullRef.current = 0;
      setPullDistance(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0 || refreshingRef.current) return;
      startYRef.current = e.touches[0]!.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const delta = e.touches[0]!.clientY - startYRef.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPullDistance(0);
        return;
      }
      // Safari treats touch listeners as passive by default — without { passive: false }
      // below, this preventDefault() is silently ignored and the page scrolls instead.
      e.preventDefault();
      const next = Math.min(delta / RESISTANCE, MAX_PULL);
      pullRef.current = next;
      setPullDistance(next);
    };

    const onTouchEnd = () => {
      if (startYRef.current === null) return;
      if (pullRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        startYRef.current = null;
        Promise.resolve(onRefresh()).finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          reset();
        });
        return;
      }
      reset();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [disabled, onRefresh]);

  return { containerRef, pullDistance, pullThreshold: PULL_THRESHOLD, refreshing };
}
