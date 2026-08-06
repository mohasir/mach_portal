'use client';
import { useRef, type ReactNode } from 'react';
import { Drawer } from 'antd';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Fixed at the bottom, outside the scrollable body — for a primary action like "Save". */
  footer?: ReactNode;
  /** Extra classes for the footer slot itself (e.g. a top shadow), scoped to this instance only. */
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
  // Callers often clear their own state (title/children) the same render `open`
  // flips to false (e.g. a `mode` field driving both). AntD's Drawer with
  // size="auto" measures content height to drive its close transition, so
  // content going blank mid-close confuses it — the panel gets stuck visible
  // with no mask. Freeze the last real content while closed so the Drawer
  // always animates against stable content.
  const lastContent = useRef<SheetContent>({ title, footer, children });
  if (open) lastContent.current = { title, footer, children };
  const displayed = open ? { title, footer, children } : lastContent.current;

  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      closable={false}
      size="auto"
      footer={displayed.footer}
      classNames={{
        wrapper: 'overflow-hidden rounded-t-4xl flex flex-col',
        section: 'overflow-hidden h-auto min-h-0 flex-1',
        body: 'p-0 overflow-y-auto min-h-0',
        header: 'border-none',
        footer: `pb-8 ${footerClassName}`,
      }}
      styles={{ wrapper: { maxHeight: '85dvh' } }}
      title={
        <div className="flex flex-col items-center gap-2">
          <span className="bg-primary h-1 w-10 mb-2 rounded-full" />
          {displayed.title && <span>{displayed.title}</span>}
        </div>
      }
    >
      <div className="mx-2 min-h-50 mb-6">{displayed.children}</div>
    </Drawer>
  );
}
