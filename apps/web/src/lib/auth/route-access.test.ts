import { describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { resolveRouteAccess } from './route-access';

describe('resolveRouteAccess', () => {
  it('requires EVENT:RESCHEDULE on the reschedule screen', () => {
    expect(resolveRouteAccess('/admin/events/abc-123/reschedule')).toEqual({
      [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE],
    });
  });

  it('keeps EVENT:READ for the event detail', () => {
    expect(resolveRouteAccess('/admin/events/abc-123')).toEqual({
      [RESOURCES.EVENT]: [ACTIONS.READ],
    });
  });

  it('requires RESCHEDULE_REASON:VIEW on the reasons catalog', () => {
    expect(resolveRouteAccess('/admin/reschedule-reasons')).toEqual({
      [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.VIEW],
    });
  });
});
