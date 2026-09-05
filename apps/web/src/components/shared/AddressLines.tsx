'use client';
import { useTranslation } from 'react-i18next';
import { TbMapPinFilled } from 'react-icons/tb';

interface AddressLinesProps {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  lines?: 1 | 2;
  className?: string;
  showIcon?: boolean;
}

export function AddressLines({
  address,
  city,
  state,
  lines = 2,
  className,
  showIcon = false,
}: AddressLinesProps) {
  const { t } = useTranslation('common');
  const stateLabel = state ? t(`states.${state}`, state) : state;
  const cityState = [city, stateLabel].filter(Boolean).join(', ');
  if (!address && !cityState) return null;

  const icon = showIcon && <TbMapPinFilled size={14} className="text-primary shrink-0" />;

  if (lines === 1) {
    return (
      <div className={`flex items-center gap-1 ${className ?? ''}`}>
        {icon}
        <span className="truncate">{[address, cityState].filter(Boolean).join(', ')}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-1 ${className ?? ''}`}>
      <div className="flex items-center justify-center h-5">
        {showIcon && <TbMapPinFilled size={14} className="text-primary shrink-0" />}
      </div>
      <div className="min-w-0">
        {address && <div>{address}</div>}
        {cityState && <div className="truncate">{cityState}</div>}
      </div>
    </div>
  );
}
