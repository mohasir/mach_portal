'use client';
import { Button, Space } from 'antd';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';

interface ReorderControlProps {
  dragHandleProps?: Record<string, unknown>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}

// Desktop: dnd-kit drag handle. Mobile: ↑/↓ buttons (touch drag inside a nested
// accordion is awkward — docs/mach-bar-flows.md §4.4/§4.8).
export function ReorderControl({
  dragHandleProps,
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
}: ReorderControlProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <span
        {...dragHandleProps}
        className="text-muted flex shrink-0 cursor-grab touch-none items-center active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </span>
    );
  }

  return (
    <Space size={0} className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <Button type="text" size="small" icon={<ChevronUp size={14} />} disabled={disableUp} onClick={onMoveUp} />
      <Button type="text" size="small" icon={<ChevronDown size={14} />} disabled={disableDown} onClick={onMoveDown} />
    </Space>
  );
}
