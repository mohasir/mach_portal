'use client';
import { useState, type ReactNode } from 'react';
import { Popover } from 'antd';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { FilterChip } from './FilterChip';

interface FilterChipPanelProps {
  active: boolean;
  /** Chip text. */
  label: ReactNode;
  children: ReactNode;
  /** Controlled open state, for panels that close themselves (e.g. after an "Apply"). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Size/scroll of the desktop popover body. */
  popoverClassName?: string;
}

/** An expandable chip whose panel opens in a popover on desktop and a bottom sheet on mobile. */
export function FilterChipPanel({
  active,
  label,
  children,
  open: openProp,
  onOpenChange,
  popoverClassName = 'max-h-96 w-72 overflow-y-auto py-2',
}: FilterChipPanelProps) {
  const isDesktop = useIsDesktop();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  const chip = (
    // On desktop the Popover owns the click (it toggles itself), so the chip only opens the sheet.
    <FilterChip active={active} expandable onClick={isDesktop ? undefined : () => setOpen(true)}>
      {label}
    </FilterChip>
  );

  if (isDesktop) {
    return (
      <Popover
        trigger="click"
        placement="bottomLeft"
        open={open}
        onOpenChange={setOpen}
        arrow={false}
        content={<div className={popoverClassName}>{children}</div>}
        classNames={{ container: 'p-0' }}
      >
        {chip}
      </Popover>
    );
  }

  return (
    <>
      {chip}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        {children}
      </BottomSheet>
    </>
  );
}
