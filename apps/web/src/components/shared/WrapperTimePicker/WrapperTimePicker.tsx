'use client';
import { useState, type MouseEvent } from 'react';
import { Button, TimePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { AutoCloseTimePicker } from '@/components/shared/Inputs/AutoCloseTimePicker';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { isTimeDisabled, toWheelValue } from './helpers';
import { TimeWheel } from './TimeWheel';
import type { WrapperTimePickerProps } from './types';

/**
 * Time field that follows the user's 12h/24h preference. Desktop keeps AntD's popover picker;
 * mobile shows the same-looking input, but tapping it opens a bottom sheet with a scroll wheel.
 */
export function WrapperTimePicker({
  value,
  onChange,
  sheetTitle,
  minuteStep = 15,
  disabledTime,
  ...pickerProps
}: WrapperTimePickerProps) {
  const { t } = useTranslation('common');
  const isDesktop = useIsDesktop();
  const { timeInputFormat, is12h } = useDateFormatter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Dayjs>(() => toWheelValue(value, minuteStep));

  if (isDesktop) {
    return (
      <AutoCloseTimePicker
        {...pickerProps}
        value={value}
        onChange={(next) => onChange?.(next)}
        format={timeInputFormat}
        minuteStep={minuteStep}
        disabledTime={disabledTime}
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
    setDraft(toWheelValue(value, minuteStep));
    setOpen(true);
  };

  const disabledConfig = disabledTime?.(draft) ?? {};

  const confirm = () => {
    onChange?.(draft);
    setOpen(false);
  };

  return (
    <>
      <TimePicker
        {...pickerProps}
        value={value}
        onChange={(next) => onChange?.(next)}
        format={timeInputFormat}
        open={false}
        inputReadOnly
        onClick={openSheet}
      />
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheetTitle}
        footer={
          <Button
            type="primary"
            block
            disabled={isTimeDisabled(draft, disabledConfig)}
            onClick={confirm}
          >
            {t('pickers.done')}
          </Button>
        }
      >
        {open && (
          <TimeWheel
            value={draft}
            onChange={setDraft}
            is12h={is12h}
            minuteStep={minuteStep}
            disabled={disabledConfig}
          />
        )}
      </BottomSheet>
    </>
  );
}
