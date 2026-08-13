import type { ReactNode } from 'react';
import { Flex } from 'antd';

interface SwitchRowProps {
  title: ReactNode;
  caption?: ReactNode;
  control: ReactNode;
  className?: string;
}

/** Label + caption on the left, a switch (or any control) flush right — same row used
 * throughout Settings and the quote builder for on/off preferences. */
export function SwitchRow({ title, caption, control, className }: SwitchRowProps) {
  return (
    <Flex justify="space-between" align="start" gap={16} className={className}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <span className="text-sm">{title}</span>
        {caption && <span className="text-gray-500 text-xs font-normal">{caption}</span>}
      </span>
      {control}
    </Flex>
  );
}
