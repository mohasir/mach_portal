'use client';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { IconBadge } from '@/components/shared/IconBadge';
import { WrapperCard } from '@/components/shared/WrapperCard';

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
    <WrapperCard title={title}>
      <div>
        {items.map(({ key, label, icon: Icon }, index) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`flex w-full items-center gap-3 py-4 text-left text-base ${
              index > 0 ? 'border-line/50 border-t' : ''
            }`}
          >
            <IconBadge icon={Icon} />
            <span className="flex-1">{label}</span>
            <ChevronRight size={16} className="text-muted shrink-0" />
          </button>
        ))}
      </div>
    </WrapperCard>
  );
}
