'use client';
import { Card, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { AddressLines } from '@/components/shared/AddressLines';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useEventRowActions } from '../hooks/useEventRowActions';
import { PAYMENT_STATUS_BAR_CLASSES, PAYMENT_STATUS_COLORS } from '../helpers';
import type { Event } from '../types';

type DateBadgeColor = 'olive' | 'mustard';

// Decorative theme for the day-of-month/weekday chip — not tied to event status (that stays
// a Tag on the desktop table); differs by call site (listing vs dashboard widget).
const DATE_BADGE_CLASSES: Record<DateBadgeColor, string> = {
  olive: 'bg-olive-faint text-brown',
  mustard: 'bg-mustard text-brown',
};

interface EventCardProps {
  row: Event;
  onClick: () => void;
  onAssignStaff: (event: Event) => void;
  /** Payment status tag — only the events listing shows it, not the dashboard widget. */
  showPaymentStatus?: boolean;
  colorDateBadge?: DateBadgeColor;
  /** Row actions ("...") menu — hidden on the dashboard widget. */
  showActions?: boolean;
  /** Event type line — hidden on the dashboard widget. */
  showEventType?: boolean;
}

export function EventCard({
  row,
  onClick,
  onAssignStaff,
  showPaymentStatus,
  colorDateBadge = 'olive',
  showActions = true,
  showEventType = true,
}: EventCardProps) {
  const { t } = useTranslation('events');
  const { t: tc } = useTranslation('common');
  const { dayOfMonth, monthShort, time } = useDateFormatter();
  const rowActions = useEventRowActions({ onAssignStaff });
  const badgeClass = DATE_BADGE_CLASSES[colorDateBadge];

  return (
    <Card
      onClick={onClick}
      className={`relative cursor-pointer ${showPaymentStatus ? 'pl-2' : ''}`}
    >
      {showPaymentStatus && (
        <div
          className={`absolute top-2 bottom-2 left-2 w-1.5 rounded-full ${PAYMENT_STATUS_BAR_CLASSES[row.paymentStatus]}`}
        />
      )}
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div
            className={`flex size-14 flex-col items-center justify-center rounded-2xl ${badgeClass}`}
          >
            {row.eventDate ? (
              <>
                <span className="text-lg leading-none font-bold">{dayOfMonth(row.eventDate)}</span>
                <span className="text-xs">{monthShort(row.eventDate)}</span>
              </>
            ) : (
              <span className="text-xs">—</span>
            )}
          </div>
          {row.eventTime && <span className="text-xs text-gray-500">{time(row.eventTime)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-sm">{row.clientName}</span>
            {showPaymentStatus && (
              <Tag className="m-0 shrink-0" color={PAYMENT_STATUS_COLORS[row.paymentStatus]}>
                {t(`detail.payments.status.${row.paymentStatus}`)}
              </Tag>
            )}
          </div>
          <div className="mt-1">
            {showEventType && row.eventTypeName && (
              <div className="mt-0.5 truncate text-sm text-gray-500">{row.eventTypeName}</div>
            )}
            <AddressLines
              address={row.address}
              city={row.city}
              state={row.state}
              className="mt-0.5 text-sm text-gray-500"
            />
          </div>
        </div>
        {showActions && (
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
          </div>
        )}
      </div>
    </Card>
  );
}
