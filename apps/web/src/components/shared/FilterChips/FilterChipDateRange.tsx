'use client';
import { useState } from 'react';
import { Button } from 'antd';
import dayjs from 'dayjs';
import { ChevronLeft, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DateRangeCalendar, type DateRange } from '@/components/shared/DateRangeCalendar';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { FilterChipPanel } from './FilterChipPanel';
import { FilterPanelHeader } from './FilterPanelHeader';
import type { DateRangeValue } from './types';

const ISO_DATE = 'YYYY-MM-DD';

type PresetKey = 'today' | 'last7Days' | 'thisMonth' | 'lastMonth';

const PRESET_KEYS: PresetKey[] = ['today', 'last7Days', 'thisMonth', 'lastMonth'];

/** With `disableFuture`, ranges that would reach past today stop at today instead. */
function presetRange(key: PresetKey, disableFuture: boolean): DateRange {
  const today = dayjs();
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'last7Days':
      return { from: today.subtract(6, 'day'), to: today };
    case 'thisMonth':
      return { from: today.startOf('month'), to: disableFuture ? today : today.endOf('month') };
    case 'lastMonth':
      return {
        from: today.subtract(1, 'month').startOf('month'),
        to: today.subtract(1, 'month').endOf('month'),
      };
  }
}

const toValue = ({ from, to }: DateRange): DateRangeValue => ({
  from: from?.format(ISO_DATE),
  to: to?.format(ISO_DATE),
});
const toRange = ({ from, to }: DateRangeValue): DateRange => ({
  from: from ? dayjs(from) : null,
  to: to ? dayjs(to) : null,
});
const presetOf = (range: DateRangeValue, disableFuture: boolean) =>
  PRESET_KEYS.find((key) => {
    const preset = toValue(presetRange(key, disableFuture));
    return preset.from === range.from && preset.to === range.to;
  });

interface FilterChipDateRangeProps {
  /** Chip text while no range is set; also the panel title. */
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Days after today can't be picked, for dates that only exist in the past (e.g. payments). */
  disableFuture?: boolean;
}

/**
 * Date range filter as a chip. The panel lists quick presets (applied on tap) and a custom range
 * option; the custom range is a draft until "Apply", so half-picked ranges never hit the query.
 */
export function FilterChipDateRange({
  label,
  value,
  onChange,
  disableFuture = false,
}: FilterChipDateRangeProps) {
  const { t } = useTranslation('common');
  const { date } = useDateFormatter();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState<DateRange>(() => toRange(value));

  const hasValue = !!(value.from || value.to);
  const appliedPreset = presetOf(value, disableFuture);

  const chipLabel = appliedPreset
    ? t(`filters.datePresets.${appliedPreset}`)
    : value.from && value.to
      ? `${date(value.from)} – ${date(value.to)}`
      : value.from
        ? t('filters.dateFrom', { date: date(value.from) })
        : value.to
          ? t('filters.dateTo', { date: date(value.to) })
          : label;

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(toRange(value));
      // A range that isn't a preset reopens where it was made.
      setCustom(hasValue && !appliedPreset);
    }
    setOpen(next);
  };

  const applyRange = (range: DateRangeValue) => {
    onChange(range);
    setOpen(false);
  };

  const clear = () => {
    setDraft({ from: null, to: null });
    applyRange({});
  };

  return (
    <FilterChipPanel
      active={hasValue}
      label={chipLabel}
      open={open}
      onOpenChange={onOpenChange}
      popoverClassName="w-80 py-2"
    >
      <div className="flex flex-col">
        <FilterPanelHeader title={label} clearDisabled={!hasValue} onClear={clear} />
        {/* Both views share one grid cell and only swap visibility, so the panel always takes the
            taller (custom range) height and doesn't jump when switching between them. */}
        <div className="grid">
          <div
            className={`col-start-1 row-start-1 flex flex-col gap-2 px-4 ${
              custom ? 'invisible' : ''
            }`}
            aria-hidden={custom}
          >
            {PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyRange(toValue(presetRange(key, disableFuture)))}
                className={`h-12 cursor-pointer rounded-lg px-4 text-left transition-colors ${
                  appliedPreset === key
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'bg-background hover:bg-primary/5'
                }`}
              >
                {t(`filters.datePresets.${key}`)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-background px-4 text-left transition-colors hover:bg-primary/5"
            >
              <Plus size={16} />
              {t('filters.customRange')}
            </button>
          </div>

          <div
            className={`col-start-1 row-start-1 flex flex-col ${custom ? '' : 'invisible'}`}
            aria-hidden={!custom}
          >
            <button
              type="button"
              onClick={() => setCustom(false)}
              className="mx-4 mb-3 flex w-fit cursor-pointer items-center gap-1 text-sm text-muted hover:text-primary"
            >
              <ChevronLeft size={16} />
              {t('back')}
            </button>
            {open && (
              <DateRangeCalendar
                value={draft}
                onChange={setDraft}
                disabledDate={disableFuture ? (day) => day.isAfter(dayjs(), 'day') : undefined}
              />
            )}
            <div className="px-4 pt-3">
              <Button
                type="primary"
                block
                disabled={!draft.from}
                onClick={() => applyRange(toValue(draft))}
              >
                {t('filters.apply')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FilterChipPanel>
  );
}
