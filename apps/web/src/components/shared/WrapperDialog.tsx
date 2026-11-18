'use client';
import type { ComponentProps } from 'react';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { BottomSheet } from './BottomSheet';
import { WrapperModal } from './WrapperModal';

type WrapperDialogProps = ComponentProps<typeof BottomSheet>;

/** Shows a `BottomSheet` on mobile and a `WrapperModal` on desktop. Takes the same props as `BottomSheet`. */
export function WrapperDialog({
  open,
  onClose,
  title,
  footer,
  footerClassName,
  children,
}: WrapperDialogProps) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        footer={footer}
        footerClassName={footerClassName}
      >
        {children}
      </BottomSheet>
    );
  }

  return (
    <WrapperModal open={open} onCancel={onClose} title={title} footer={footer} destroyOnHidden>
      {children}
    </WrapperModal>
  );
}
