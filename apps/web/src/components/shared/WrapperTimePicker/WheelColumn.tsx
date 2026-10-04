'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WHEEL_ITEM_HEIGHT_PX, WHEEL_SETTLE_MS } from './constants';
import type { WheelItem } from './types';

interface WheelColumnProps<T extends string | number> {
  items: WheelItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** One scroll-snapping column: whichever row settles in the center band is the value. */
export function WheelColumn<T extends string | number>({
  items,
  value,
  onChange,
  ariaLabel,
}: WheelColumnProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );
  const [centeredIndex, setCenteredIndex] = useState(selectedIndex);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const align = () => {
      if (Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT_PX) !== selectedIndex) {
        el.scrollTop = selectedIndex * WHEEL_ITEM_HEIGHT_PX;
      }
    };
    align();
    setCenteredIndex(selectedIndex);
    // On the sheet's first open the drawer may not have laid out yet, so the scroll above is
    // ignored; retry once it has.
    const frame = requestAnimationFrame(align);
    return () => cancelAnimationFrame(frame);
  }, [selectedIndex]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    const index = Math.min(
      items.length - 1,
      Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT_PX)),
    );
    setCenteredIndex(index);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const item = items[index];
      if (item && item.value !== value) onChange(item.value);
    }, WHEEL_SETTLE_MS);
  };

  const scrollTo = (index: number) =>
    ref.current?.scrollTo({ top: index * WHEEL_ITEM_HEIGHT_PX, behavior: 'smooth' });

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={handleScroll}
      className="relative z-10 h-55 w-16 snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="h-22" aria-hidden />
      {items.map((item, index) => (
        <div
          key={item.value}
          role="option"
          aria-selected={index === centeredIndex}
          aria-disabled={item.disabled}
          onClick={() => scrollTo(index)}
          className={`flex h-11 snap-center items-center justify-center text-2xl tabular-nums transition-colors ${
            index === centeredIndex ? 'text-brown font-medium' : 'text-muted'
          } ${item.disabled ? 'opacity-30' : ''}`}
        >
          {item.label}
        </div>
      ))}
      <div className="h-22" aria-hidden />
    </div>
  );
}
