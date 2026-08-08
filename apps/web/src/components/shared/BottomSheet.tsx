'use client';
import { useRef, type ReactNode } from 'react';
import { Drawer } from 'antd';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  children: ReactNode;
}

interface SheetContent {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Mobile action sheet: a bottom Drawer with a drag handle instead of a close button. */
export function BottomSheet({
  open,
  onClose,
  title,
  footer,
  footerClassName,
  children,
}: BottomSheetProps) {
  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      closable={false}
      size="auto"
      focusable={{ trap: false }}
      footer={footer}
      classNames={{
        section: 'overflow-hidden rounded-t-4xl h-auto min-h-0 flex-1',
        body: 'p-0 overflow-y-auto min-h-0',
        header: 'border-none',
        footer: `pb-8 ${footerClassName}`,
      }}
      styles={{ wrapper: { maxHeight: '85dvh' } }}
      title={
        <div className="flex flex-col items-center gap-2">
          <span className="bg-primary h-1 w-10 mb-2 rounded-full" />
          {title && <span>{title}</span>}
        </div>
      }
    >
      <div className="mx-2 min-h-50 mb-6">{children}</div>
    </Drawer>
  );
}
