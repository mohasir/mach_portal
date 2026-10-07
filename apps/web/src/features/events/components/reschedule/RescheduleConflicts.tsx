'use client';
import { TbExternalLink } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import type { RouterOutputs } from '@/lib/trpc/types';

type RescheduleCheck = RouterOutputs['events']['checkReschedule'];

interface RescheduleConflictsProps {
  check: RescheduleCheck | undefined;
  isChecking: boolean;
}

export function RescheduleConflicts({ check, isChecking }: RescheduleConflictsProps) {
  const { t } = useTranslation('events');
  const { time } = useDateFormatter();

  if (!check || isChecking) return null;

  const { staffConflicts, eventConflicts } = check;
  if (staffConflicts.length === 0 && eventConflicts.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {staffConflicts.length > 0 && (
        <WrapperAlert
          type="warning"
          showIcon
          closeable={false}
          title={t('reschedule.staffConflictsTitle')}
          description={
            <div className="flex flex-col gap-2">
              <span>{t('reschedule.staffConflictsDescription')}</span>
              <ul className="list-disc pl-4">
                {staffConflicts.map(({ staffId, name, conflictingEvent }) => (
                  <li key={`${staffId}-${conflictingEvent.id}`}>
                    <strong>{name}</strong>
                    {conflictingEvent.eventTime ? `: ${time(conflictingEvent.eventTime)}` : ''} (
                    <a
                      href={`/admin/events/${conflictingEvent.id}?tab=staff`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={conflictingEvent.quoteNumber}
                      className="text-primary inline-flex items-center gap-1 underline"
                    >
                      {conflictingEvent.quoteNumber.slice(-6)}
                      <TbExternalLink size={14} />
                    </a>
                    )
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      )}
      {eventConflicts.length > 0 && (
        <WrapperAlert
          type="warning"
          showIcon
          closeable={false}
          title={t('reschedule.eventConflictsTitle')}
          description={
            <ul className="list-disc pl-4">
              {eventConflicts.map((conflict) => (
                <li key={conflict.id}>
                  {conflict.clientName} — {conflict.eventTypeName ?? '—'}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
}
