import type { ReactNode } from 'react';
import type { DatePickerProps } from 'antd';
import type { Dayjs } from 'dayjs';

export interface WrapperDatePickerProps extends Omit<
  DatePickerProps,
  'value' | 'onChange' | 'open' | 'picker' | 'disabledDate'
> {
  value?: Dayjs | null;
  onChange?: (value: Dayjs | null) => void;
  /** Title of the mobile bottom sheet. */
  sheetTitle?: ReactNode;
  disabledDate?: (date: Dayjs) => boolean;
}
