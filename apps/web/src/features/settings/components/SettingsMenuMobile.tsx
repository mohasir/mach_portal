'use client';
import { Typography } from 'antd';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { IconBadge } from '@/components/shared/IconBadge';

interface SettingsMenuMobileItem {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsMenuMobileProps {
  title: string;
  items: SettingsMenuMobileItem[];
  onSelect: (key: string) => void;
}

export function SettingsMenuMobile({ title, items, onSelect }: SettingsMenuMobileProps) {
  return (
    <div className="flex flex-col gap-2 mx-2">
      <Typography.Text strong className="text-brown px-1">
        {title}
      </Typography.Text>

      <div>
        {items.map(({ key, label, icon: Icon }, index) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`flex w-full items-center gap-3 px-1 py-3 text-left text-sm ${
              index > 0 ? 'border-line/50 border-t' : ''
            }`}
          >
            <IconBadge icon={Icon} />
            <span className="flex-1">{label}</span>
            <ChevronRight size={16} className="text-muted shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
