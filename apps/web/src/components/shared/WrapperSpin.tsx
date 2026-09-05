'use client';
import { createPortal } from 'react-dom';
import { Spin, type SpinProps } from 'antd';

interface WrapperSpinProps extends Omit<SpinProps, 'spinning' | 'fullscreen' | 'children'> {
  spinning: boolean;
}

/**
 * Full-screen loading overlay, portaled straight to `document.body`. AntD's own
 * `Spin fullscreen` doesn't portal — it just applies `position: fixed` inline in the
 * tree, so if it renders inside an ancestor with a `transform` (eg. a dnd-kit
 * draggable card), it gets trapped in that ancestor's stacking context and paints
 * behind unrelated fixed elements elsewhere on the page (a sticky Topbar, a FAB
 * button). Portaling escapes that regardless of where this is mounted.
 */
export function WrapperSpin({ spinning, size = 'large', ...spinProps }: WrapperSpinProps) {
  if (!spinning) return null;
  return createPortal(
    <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/40">
      <Spin size={size} {...spinProps} />
    </div>,
    document.body,
  );
}
