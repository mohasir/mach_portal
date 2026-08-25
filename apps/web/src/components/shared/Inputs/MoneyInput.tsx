'use client';
import { InputNumber, type InputNumberProps } from 'antd';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { fromMajorUnit, toMajorUnit } from '@/lib/utils/money';

interface MoneyInputProps extends Omit<
  InputNumberProps<number>,
  'value' | 'onChange' | 'min' | 'max' | 'prefix'
> {
  /** Cents, matching how money is stored across the app's domain/state. */
  value?: number | null;
  onChange?: (cents: number | null) => void;
  min?: number;
  max?: number;
}

const toDisplay = (cents?: number | null) => (cents == null ? undefined : toMajorUnit(cents));

export function MoneyInput({ value, onChange, min, max, precision = 2, ...rest }: MoneyInputProps) {
  const { currencySymbol } = useMoneyFormatter();

  return (
    <InputNumber<number>
      {...rest}
      value={toDisplay(value)}
      min={toDisplay(min)}
      max={toDisplay(max)}
      precision={precision}
      prefix={currencySymbol}
      onChange={(next) => onChange?.(next == null ? null : fromMajorUnit(Number(next)))}
    />
  );
}
