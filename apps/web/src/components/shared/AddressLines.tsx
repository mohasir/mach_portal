'use client';
import { TbMapPinFilled } from 'react-icons/tb';
import { formatPlace } from './LocationFields/helpers';

interface AddressLinesProps {
  address?: string | null;
  country?: string | null;
  region?: string | null;
  locality?: string | null;
  lines?: 1 | 2;
  className?: string;
  showIcon?: boolean;
}

export function AddressLines({
  address,
  country,
  region,
  locality,
  lines = 2,
  className,
  showIcon = false,
}: AddressLinesProps) {
  const place = formatPlace(country, region, locality);
  if (!address && !place) return null;

  const icon = showIcon && <TbMapPinFilled size={14} className="text-navy shrink-0" />;

  if (lines === 1) {
    return (
      <div className={`flex items-center gap-1 ${className ?? ''}`}>
        {icon}
        <span className="truncate">{[address, place].filter(Boolean).join(', ')}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-1 ${className ?? ''}`}>
      <div className="flex items-center justify-center h-5">
        {showIcon && <TbMapPinFilled size={14} className="text-navy shrink-0" />}
      </div>
      <div className="min-w-0">
        {address && <div>{address}</div>}
        {place && <div className="truncate">{place}</div>}
      </div>
    </div>
  );
}
