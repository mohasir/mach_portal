import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RescheduleEventInput } from '@repo/schemas';
import type { StorageProvider } from '../../lib/storage';
import type { ConfigRepository } from '../config/config.repository';
import type { NotificationsRepository } from '../notifications/notifications.repository';
import type { QuotesRepository } from '../quotes/quotes.repository';
import type { RescheduleReasonsRepository } from '../rescheduleReasons/rescheduleReasons.repository';
import type { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const QUOTE_ID = '00000000-0000-4000-8000-000000000002';
const REASON_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID = 'user-1';
const ACTOR = { name: 'Ana Admin', image: null };

const upcomingEvent = () => ({
  id: EVENT_ID,
  quoteId: QUOTE_ID,
  eventDate: '2026-10-20' as string | null,
  eventTime: '18:00' as string | null,
  completedAt: null as Date | null,
  quoteCancelled: false,
  quoteNumber: 'Q-0001',
  clientName: 'Cliente Uno',
});

const activeReason = () => ({
  id: REASON_ID,
  name: 'Clima',
  requiresNote: false,
  isActive: true,
  sortOrder: 0,
});

function makeFakes() {
  const eventsRepo = {
    isAccessible: vi.fn().mockResolvedValue(true),
    findForReschedule: vi.fn().mockResolvedValue(upcomingEvent()),
    findStaffConflicts: vi.fn().mockResolvedValue([]),
    reschedule: vi.fn().mockResolvedValue({ id: EVENT_ID }),
  };
  const quotesRepo = {
    findByDate: vi.fn().mockResolvedValue([]),
    findByDateTime: vi.fn().mockResolvedValue([]),
  };
  const reasonsRepo = { findById: vi.fn().mockResolvedValue(activeReason()) };
  const notificationsRepo = { create: vi.fn().mockResolvedValue(undefined) };
  const service = new EventsService(
    eventsRepo as unknown as EventsRepository,
    quotesRepo as unknown as QuotesRepository,
    {} as ConfigRepository,
    reasonsRepo as unknown as RescheduleReasonsRepository,
    notificationsRepo as unknown as NotificationsRepository,
    {} as StorageProvider,
  );
  return { service, eventsRepo, quotesRepo, reasonsRepo, notificationsRepo };
}

const input = (overrides: Partial<RescheduleEventInput> = {}): RescheduleEventInput => ({
  eventId: EVENT_ID,
  eventDate: '2026-10-25',
  eventTime: '19:00',
  reasonId: REASON_ID,
  ...overrides,
});

const rejectsWith = (promise: Promise<unknown>, code: string, errorCode: string) =>
  expect(promise).rejects.toMatchObject({ code, cause: { code: errorCode } });

describe('EventsService.reschedule', () => {
  let fakes: ReturnType<typeof makeFakes>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T15:00:00Z'));
    fakes = makeFakes();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const run = (data = input()) => fakes.service.reschedule(data, USER_ID, ACTOR);

  it('is NOT_FOUND when the event is not accessible', async () => {
    fakes.eventsRepo.isAccessible.mockResolvedValue(false);
    await rejectsWith(run(), 'NOT_FOUND', 'EVENT_NOT_FOUND');
    expect(fakes.eventsRepo.reschedule).not.toHaveBeenCalled();
  });

  it('rejects a completed event', async () => {
    fakes.eventsRepo.findForReschedule.mockResolvedValue({
      ...upcomingEvent(),
      completedAt: new Date(),
    });
    await rejectsWith(run(), 'BAD_REQUEST', 'EVENT_NOT_RESCHEDULABLE');
  });

  it('rejects an event whose quote was cancelled', async () => {
    fakes.eventsRepo.findForReschedule.mockResolvedValue({
      ...upcomingEvent(),
      quoteCancelled: true,
    });
    await rejectsWith(run(), 'BAD_REQUEST', 'EVENT_NOT_RESCHEDULABLE');
  });

  it('rejects a date before the business today', async () => {
    await rejectsWith(run(input({ eventDate: '2026-10-09' })), 'BAD_REQUEST', 'EVENT_DATE_IN_PAST');
  });

  it('accepts today as the new date', async () => {
    await run(input({ eventDate: '2026-10-10' }));
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledOnce();
  });

  it('accepts an event whose date already passed but was never completed', async () => {
    fakes.eventsRepo.findForReschedule.mockResolvedValue({
      ...upcomingEvent(),
      eventDate: '2026-10-01',
    });
    await run(input({ eventDate: '2026-10-15' }));
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledOnce();
  });

  it('rejects the same date and time', async () => {
    await rejectsWith(
      run(input({ eventDate: '2026-10-20', eventTime: '18:00' })),
      'BAD_REQUEST',
      'EVENT_SAME_SCHEDULE',
    );
  });

  it('treats a stored H:mm time and the same HH:mm time as unchanged', async () => {
    fakes.eventsRepo.findForReschedule.mockResolvedValue({ ...upcomingEvent(), eventTime: '9:00' });
    await rejectsWith(
      run(input({ eventDate: '2026-10-20', eventTime: '09:00' })),
      'BAD_REQUEST',
      'EVENT_SAME_SCHEDULE',
    );
  });

  it('accepts changing only the time', async () => {
    await run(input({ eventDate: '2026-10-20', eventTime: '20:00' }));
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledOnce();
  });

  it('accepts an event that had no date or time', async () => {
    fakes.eventsRepo.findForReschedule.mockResolvedValue({
      ...upcomingEvent(),
      eventDate: null,
      eventTime: null,
    });
    await run();
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledWith(
      expect.objectContaining({ from: { date: null, time: null } }),
    );
  });

  it('clears the time when the new schedule has none', async () => {
    await run(input({ eventDate: '2026-10-20', eventTime: undefined }));
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledWith(
      expect.objectContaining({ to: { date: '2026-10-20', time: null } }),
    );
  });

  it('rejects a reason that does not exist', async () => {
    fakes.reasonsRepo.findById.mockResolvedValue(undefined);
    await rejectsWith(run(), 'NOT_FOUND', 'RESCHEDULE_REASON_NOT_FOUND');
  });

  it('rejects an inactive reason', async () => {
    fakes.reasonsRepo.findById.mockResolvedValue({ ...activeReason(), isActive: false });
    await rejectsWith(run(), 'BAD_REQUEST', 'RESCHEDULE_REASON_INACTIVE');
    expect(fakes.eventsRepo.reschedule).not.toHaveBeenCalled();
  });

  it('requires a note when the reason demands one', async () => {
    fakes.reasonsRepo.findById.mockResolvedValue({ ...activeReason(), requiresNote: true });
    await rejectsWith(run(), 'BAD_REQUEST', 'EVENT_RESCHEDULE_NOTE_REQUIRED');
  });

  it('saves with a note when the reason demands one', async () => {
    fakes.reasonsRepo.findById.mockResolvedValue({ ...activeReason(), requiresNote: true });
    await run(input({ note: 'Se mudó el salón' }));
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Se mudó el salón', reasonName: 'Clima' }),
    );
  });

  it('saves despite staff conflicts and records them', async () => {
    fakes.eventsRepo.findStaffConflicts.mockResolvedValue([
      {
        staffId: 's1',
        name: 'Ana',
        conflictingEvent: { id: 'e2', quoteNumber: 'Q-0002', eventTime: '12:00' },
      },
    ]);
    await run();
    expect(fakes.eventsRepo.findStaffConflicts).toHaveBeenCalledWith(EVENT_ID, '2026-10-25');
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledWith(
      expect.objectContaining({ staffConflicts: [{ staffId: 's1', name: 'Ana' }] }),
    );
  });

  it('records each clashing staff member once even with several clashing events', async () => {
    fakes.eventsRepo.findStaffConflicts.mockResolvedValue([
      {
        staffId: 's1',
        name: 'Ana',
        conflictingEvent: { id: 'e2', quoteNumber: 'Q-0002', eventTime: '12:00' },
      },
      {
        staffId: 's1',
        name: 'Ana',
        conflictingEvent: { id: 'e3', quoteNumber: 'Q-0003', eventTime: '20:00' },
      },
    ]);
    await run();
    expect(fakes.eventsRepo.reschedule).toHaveBeenCalledWith(
      expect.objectContaining({ staffConflicts: [{ staffId: 's1', name: 'Ana' }] }),
    );
  });

  it('notifies admins except the actor', async () => {
    await run();
    expect(fakes.notificationsRepo.create).toHaveBeenCalledWith({
      type: 'event_rescheduled',
      entityType: 'event',
      entityId: EVENT_ID,
      excludedUserId: USER_ID,
      data: {
        source: 'user',
        actor: ACTOR,
        quoteNumber: 'Q-0001',
        clientName: 'Cliente Uno',
        fromDate: '2026-10-20',
        toDate: '2026-10-25',
        toTime: '19:00',
      },
    });
  });
});

describe('EventsService.checkReschedule', () => {
  let fakes: ReturnType<typeof makeFakes>;

  beforeEach(() => {
    fakes = makeFakes();
  });

  it('checks double booking by date and time when a time is given', async () => {
    fakes.quotesRepo.findByDateTime.mockResolvedValue([
      { id: 'q2', number: 'Q-0002', clientName: 'Otro', eventTypeName: null },
    ]);
    const result = await fakes.service.checkReschedule({
      eventId: EVENT_ID,
      eventDate: '2026-10-25',
      eventTime: '18:00',
    });
    expect(fakes.quotesRepo.findByDateTime).toHaveBeenCalledWith('2026-10-25', '18:00', QUOTE_ID);
    expect(result.eventConflicts).toEqual([
      { id: 'q2', number: 'Q-0002', clientName: 'Otro', eventTypeName: null },
    ]);
  });

  it('checks double booking by date only when there is no time', async () => {
    await fakes.service.checkReschedule({ eventId: EVENT_ID, eventDate: '2026-10-25' });
    expect(fakes.quotesRepo.findByDate).toHaveBeenCalledWith('2026-10-25', QUOTE_ID);
    expect(fakes.quotesRepo.findByDateTime).not.toHaveBeenCalled();
  });

  it('returns the staff conflicts for the new date', async () => {
    const conflict = {
      staffId: 's1',
      name: 'Ana',
      conflictingEvent: { id: 'e2', quoteNumber: 'Q-0002', eventTime: null },
    };
    fakes.eventsRepo.findStaffConflicts.mockResolvedValue([conflict]);
    const result = await fakes.service.checkReschedule({
      eventId: EVENT_ID,
      eventDate: '2026-10-25',
    });
    expect(result.staffConflicts).toEqual([conflict]);
  });

  it('is NOT_FOUND when the event is not accessible', async () => {
    fakes.eventsRepo.isAccessible.mockResolvedValue(false);
    await rejectsWith(
      fakes.service.checkReschedule({ eventId: EVENT_ID, eventDate: '2026-10-25' }),
      'NOT_FOUND',
      'EVENT_NOT_FOUND',
    );
  });
});
