'use client';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import { formatTwoDigits, range, to12h, to24h } from './helpers';
import type { Meridiem, TimeDisabledConfig, WheelItem } from './types';
import { WheelColumn } from './WheelColumn';

interface TimeWheelProps {
  value: Dayjs;
  // Takes an updater: each column settles on its own timer, so building on a captured `value`
  // would let a late column write back what another one just changed.
  onChange: (update: (prev: Dayjs) => Dayjs) => void;
  is12h: boolean;
  minuteStep: number;
  disabled: TimeDisabledConfig;
}

const MERIDIEMS: Meridiem[] = ['am', 'pm'];

export function TimeWheel({ value, onChange, is12h, minuteStep, disabled }: TimeWheelProps) {
  const { t } = useTranslation('common');
  const hour24 = value.hour();
  const { hour: hour12, meridiem } = to12h(hour24);
  const disabledHours = new Set(disabled.disabledHours?.() ?? []);
  const disabledMinutes = new Set(disabled.disabledMinutes?.(hour24) ?? []);

  const hourItems: WheelItem<number>[] = is12h
    ? range(1, 12).map((h) => ({
        value: h,
        label: formatTwoDigits(h),
        disabled: disabledHours.has(to24h(h, meridiem)),
      }))
    : range(0, 23).map((h) => ({
        value: h,
        label: formatTwoDigits(h),
        disabled: disabledHours.has(h),
      }));

  const minuteItems: WheelItem<number>[] = range(0, 59, minuteStep).map((m) => ({
    value: m,
    label: formatTwoDigits(m),
    disabled: disabledMinutes.has(m),
  }));

  const meridiemItems: WheelItem<Meridiem>[] = MERIDIEMS.map((m) => ({
    value: m,
    label: dayjs()
      .hour(m === 'am' ? 0 : 12)
      .format('A'),
    disabled: range(0, 11).every((h) => disabledHours.has(h + (m === 'pm' ? 12 : 0))),
  }));

  return (
    <div className="relative flex items-center justify-center gap-2 py-2 mask-[linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-1/2 h-11 -translate-y-1/2 rounded-xl border border-line bg-olive-faint"
      />
      <WheelColumn
        ariaLabel={t('pickers.hours')}
        items={hourItems}
        value={is12h ? hour12 : hour24}
        onChange={(h) =>
          onChange((prev) => prev.hour(is12h ? to24h(h, to12h(prev.hour()).meridiem) : h))
        }
      />
      <span className="relative z-10 text-2xl text-muted">:</span>
      <WheelColumn
        ariaLabel={t('pickers.minutes')}
        items={minuteItems}
        value={value.minute()}
        onChange={(m) => onChange((prev) => prev.minute(m))}
      />
      {is12h && (
        <WheelColumn
          ariaLabel={t('pickers.period')}
          items={meridiemItems}
          value={meridiem}
          onChange={(m) => onChange((prev) => prev.hour(to24h(to12h(prev.hour()).hour, m)))}
        />
      )}
    </div>
  );
}
