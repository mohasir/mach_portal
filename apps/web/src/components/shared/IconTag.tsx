import { Tag, type TagProps } from 'antd';
import type { LucideIcon } from 'lucide-react';

interface IconTagProps extends Omit<TagProps, 'icon'> {
  icon?: LucideIcon;
  iconSize?: number;
}

export function IconTag({ icon: Icon, iconSize = 12, children, ...tagProps }: IconTagProps) {
  return (
    <Tag {...tagProps}>
      <span className="inline-flex items-center gap-1">
        {Icon && <Icon size={iconSize} />}
        {children}
      </span>
    </Tag>
  );
}
