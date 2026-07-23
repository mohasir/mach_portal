'use client';
import type { ReactNode } from 'react';
import { Drawer } from 'antd';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

/** Mobile action sheet: a bottom Drawer with a drag handle instead of a close button. */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      closable={false}
      size="auto"
      classNames={{ wrapper: 'overflow-hidden rounded-t-4xl', body: 'p-0' }}
      title={
        <div className="flex flex-col items-center gap-2">
          <span className="bg-primary h-1 w-10 mb-2 rounded-full" />
          {title && <span>{title}</span>}
        </div>
      }
    >
      <div className="mx-2">{children}</div>
    </Drawer>
  );
}
