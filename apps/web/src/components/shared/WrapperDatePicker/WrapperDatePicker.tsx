'use client';
import { useState, type MouseEvent } from 'react';
import { Button, Calendar, DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { CalendarHeader } from './CalendarHeader';
import type { WrapperDatePickerProps } from './types';

/**
 * Date field. Desktop keeps AntD's popover picker; mobile shows the same-looking input, but
 * tapping it opens a bottom sheet with AntD's Calendar laid out inline.
 */
export function WrapperDatePicker({
  value,
  onChange,
  sheetTitle,
  disabledDate,
  ...pickerProps
}: WrapperDatePickerProps) {
  const { t } = useTranslation('common');
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Dayjs>(() => value ?? dayjs());

  if (isDesktop) {
    return (
      <DatePicker
        {...pickerProps}
        value={value}
        onChange={(next) => onChange?.(next as Dayjs | null)}
        disabledDate={disabledDate}
      />
    );
  }

  const openSheet = (event: MouseEvent<HTMLDivElement>) => {
    if (pickerProps.disabled) return;
    // The clear icon lives inside the input; clearing shouldn't also open the sheet.
    if ((event.target as HTMLElement).closest('.ant-picker-clear')) return;
    // The drawer hands focus back to whatever had it when it opened; dropping it here leaves the
    // field unfocused once a value is picked or the sheet is dismissed.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setDraft(value ?? dayjs());
    setOpen(true);
  };

  const confirm = () => {
    onChange?.(draft);
    setOpen(false);
  };

  return (
    <>
      <DatePicker
        {...pickerProps}
        value={value}
        onChange={(next) => onChange?.(next as Dayjs | null)}
        disabledDate={disabledDate}
        open={false}
        inputReadOnly
        onClick={openSheet}
      />
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheetTitle}
        footer={
          <Button type="primary" block disabled={!!disabledDate?.(draft)} onClick={confirm}>
            {t('pickers.done')}
          </Button>
        }
      >
        {open && (
          <Calendar
            fullscreen={false}
            value={draft}
            onChange={setDraft}
            disabledDate={disabledDate}
            headerRender={({ value: month, onChange: setMonth }) => (
              <CalendarHeader value={month} onChange={setMonth} />
            )}
          />
        )}
      </BottomSheet>
    </>
  );
}
