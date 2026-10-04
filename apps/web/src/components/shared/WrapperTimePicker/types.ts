import type { ReactNode } from 'react';
import type { TimePickerProps } from 'antd';
import type { Dayjs } from 'dayjs';

/** Same shape AntD's `disabledTime` returns, so one function drives both desktop and mobile. */
export interface TimeDisabledConfig {
  disabledHours?: () => number[];
  disabledMinutes?: (hour: number) => number[];
}

export type Meridiem = 'am' | 'pm';

export interface WheelItem<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface WrapperTimePickerProps extends Omit<
  TimePickerProps,
  'value' | 'onChange' | 'format' | 'open' | 'disabledTime' | 'minuteStep' | 'use12Hours'
> {
  value?: Dayjs | null;
  onChange?: (value: Dayjs | null) => void;
  /** Title of the mobile bottom sheet. */
  sheetTitle?: ReactNode;
  minuteStep?: TimePickerProps['minuteStep'];
  disabledTime?: (now: Dayjs) => TimeDisabledConfig;
}
