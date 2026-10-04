'use client';
import type { ReactNode } from 'react';
import { Tooltip, type TooltipProps } from 'antd';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';

type WrapperTooltipProps = Omit<TooltipProps, 'title' | 'classNames'> & {
  title: ReactNode;
  caption?: ReactNode;
  classNames?: { root?: string; container?: string; arrow?: string };
};

export function WrapperTooltip({
  title,
  caption,
  trigger,
  classNames,
  ...props
}: WrapperTooltipProps) {
  const isDesktop = useIsDesktop();

  return (
    <Tooltip
      // `color` also paints the arrow, which a container class can't reach.
      color="black"
      trigger={trigger ?? (isDesktop ? 'hover' : 'click')}
      classNames={{
        ...classNames,
        // Merged rather than replaced, so a caller's container class keeps the base look.
        container: `px-4 py-3 text-gray-300 ${classNames?.container ?? ''}`,
      }}
      title={
        <span className="flex flex-col gap-0.5">
          <span className="leading-5">{title}</span>
          {caption && <span className="text-xs font-normal text-white/60 mt-2">{caption}</span>}
        </span>
      }
      {...props}
    />
  );
}
