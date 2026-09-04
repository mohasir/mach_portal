'use client';
import { useCallback, useRef } from 'react';
import { Dropdown, type DropdownProps } from 'antd';

/**
 * Thin wrapper over AntD's Dropdown that swallows the click that dismisses it via an
 * outside click. rc-trigger (Dropdown's underlying popup engine) closes the menu on a
 * capture-phase `mousedown` listener on `window`, which always fires before the
 * resulting `click` event bubbles anywhere. So when the trigger sits inside a
 * clickable row/card, that same click still reaches the row's own onClick afterwards
 * and fires it — e.g. tapping outside a row's "..." menu to close it ends up
 * navigating into the row. A one-shot capture-phase `click` listener on `window`,
 * armed the instant the menu reports closing via an outside click (not a menu item
 * selection), stops that specific click before it reaches any handler on the page.
 */
export function WrapperDropdown({ onOpenChange, ...props }: DropdownProps) {
  const wasOpenRef = useRef(false);

  const handleOpenChange = useCallback<NonNullable<DropdownProps['onOpenChange']>>(
    (open, info) => {
      if (!open && wasOpenRef.current && info.source === 'trigger') {
        const swallow = (e: MouseEvent) => e.stopPropagation();
        window.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener('click', swallow, true), 500);
      }
      wasOpenRef.current = open;
      onOpenChange?.(open, info);
    },
    [onOpenChange],
  );

  return <Dropdown {...props} onOpenChange={handleOpenChange} />;
}
