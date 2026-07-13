'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/** Wraps dnd-kit's per-row hook so Product/OptionGroup/Option rows share the same drag wiring. */
export function useSortableRow(id: string, enabled: boolean) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enabled,
  });

  return {
    setNodeRef,
    isDragging,
    style: { transform: CSS.Transform.toString(transform), transition },
    dragHandleProps: enabled ? { ...attributes, ...listeners } : undefined,
  };
}
