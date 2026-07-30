'use client';
import { InputNumber, type InputNumberProps } from 'antd';
import { toPercent, fromPercent } from '@/lib/utils/percent';

interface PercentInputProps extends Omit<
  InputNumberProps<number>,
  'value' | 'onChange' | 'suffix'
> {
  /** Decimal 0-1, matching how rates are stored across the app's domain/state. */
  value?: number | null;
  onChange?: (rate: number | null) => void;
}

export function PercentInput({
  value,
  onChange,
  precision = 0,
  min = 0,
  max = 100,
  ...rest
}: PercentInputProps) {
  return (
    <InputNumber<number>
      {...rest}
      value={value == null ? undefined : toPercent(value)}
      precision={precision}
      min={min}
      max={max}
      suffix="%"
      onChange={(next) => onChange?.(next == null ? null : fromPercent(Number(next)))}
    />
  );
}
