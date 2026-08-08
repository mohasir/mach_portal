'use client';
import { useTranslation } from 'react-i18next';

interface AddressLinesProps {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  lines?: 1 | 2;
  className?: string;
}

export function AddressLines({ address, city, state, lines = 2, className }: AddressLinesProps) {
  const { t } = useTranslation('common');
  const stateLabel = state ? t(`states.${state}`, state) : state;
  const cityState = [city, stateLabel].filter(Boolean).join(', ');
  if (!address && !cityState) return null;

  if (lines === 1) {
    return (
      <div className={`truncate ${className ?? ''}`}>
        {[address, cityState].filter(Boolean).join(', ')}
      </div>
    );
  }

  return (
    <div className={className}>
      {address && <div className="truncate">{address}</div>}
      {cityState && <div className="truncate">{cityState}</div>}
    </div>
  );
}
