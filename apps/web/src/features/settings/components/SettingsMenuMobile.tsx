'use client';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { IconBadge } from '@/components/shared/IconBadge';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface SettingsMenuMobileItem {
  key: string;
  label: string;
  icon: LucideIcon;
  group?: string;
}

interface SettingsMenuMobileProps {
  title: string;
  items: SettingsMenuMobileItem[];
  onSelect: (key: string) => void;
}

export function SettingsMenuMobile({ items, onSelect }: SettingsMenuMobileProps) {
  return (
    <div className="px-3">
      {items.map(({ key, label, icon: Icon, group }, index) => {
        const showGroupHeader = !!group && group !== items[index - 1]?.group;
        return (
          <div key={key}>
            {showGroupHeader && (
              <div className={`text-muted px-1 pb-1 text-sm ${index > 0 ? 'pt-6' : ''}`}>
                {group}
              </div>
            )}
            <button
              type="button"
              onClick={() => onSelect(key)}
              className={`flex w-full items-center gap-3 py-2.5 text-left text-base`}
            >
              <IconBadge icon={Icon} shape="square" className="bg-primary/8 text-primary" />
              <span className="flex-1">{label}</span>
              <ChevronRight size={16} className="text-muted shrink-0" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
