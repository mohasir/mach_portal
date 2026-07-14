'use client';
import { GripVertical } from 'lucide-react';

interface ReorderControlProps {
  dragHandleProps?: Record<string, unknown>;
}

export function ReorderControl({ dragHandleProps }: ReorderControlProps) {
  if (!dragHandleProps) return null;

  return (
    <span
      {...dragHandleProps}
      className="text-muted -m-1.5 flex shrink-0 cursor-grab touch-none items-center p-1.5 active:cursor-grabbing"
    >
      <GripVertical size={18} />
    </span>
  );
}
