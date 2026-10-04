import type { Dayjs } from 'dayjs';

export interface DateRange {
  from: Dayjs | null;
  to: Dayjs | null;
}

export interface DateRangeCalendarProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  disabledDate?: (day: Dayjs) => boolean;
}
