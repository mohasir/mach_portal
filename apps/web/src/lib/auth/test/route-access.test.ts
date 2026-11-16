import { describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { resolveRouteAccess, resolveRouteFeature } from '../route-access';

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

  it('requires UNIT_OF_MEASURE:READ on the units catalog', () => {
    expect(resolveRouteAccess('/admin/units-of-measure')).toEqual({
      [RESOURCES.UNIT_OF_MEASURE]: [ACTIONS.READ],
    });
  });

  it('requires ROLE:READ on the roles editor', () => {
    expect(resolveRouteAccess('/admin/roles')).toEqual({
      [RESOURCES.ROLE]: [ACTIONS.READ],
    });
  });
});

describe('resolveRouteFeature', () => {
  it('maps quote routes to the quotes feature', () => {
    expect(resolveRouteFeature('/admin/quotes')).toBe('quotes');
    expect(resolveRouteFeature('/admin/quotes/new')).toBe('quotes');
    expect(resolveRouteFeature('/admin/pipeline')).toBe('quotes');
  });

  it('maps event-related routes to the events feature', () => {
    for (const path of [
      '/admin/calendar',
      '/admin/events',
      '/admin/events/abc-123',
      '/admin/payments',
      '/admin/staff',
      '/admin/event-types',
      '/admin/reschedule-reasons',
    ]) {
      expect(resolveRouteFeature(path)).toBe('events');
    }
  });

  it('inherits the events feature on the reschedule route pattern', () => {
    expect(resolveRouteFeature('/admin/events/123/reschedule')).toBe('events');
  });

  it('maps the notifications center to the notifications feature', () => {
    expect(resolveRouteFeature('/admin/notifications')).toBe('notifications');
    expect(resolveRouteFeature('/admin/notifications/')).toBe('notifications');
  });

  it('has no feature on core routes or unknown paths', () => {
    for (const path of [
      '/admin',
      '/admin/clients',
      '/admin/users',
      '/admin/settings',
      '/admin/units-of-measure',
      '/nowhere',
    ]) {
      expect(resolveRouteFeature(path)).toBeUndefined();
    }
  });
});

describe('resolveRouteAccess for feature-only patterns', () => {
  it('keeps the dashboard guard inherited from the /admin prefix for the notifications center', () => {
    expect(resolveRouteAccess('/admin/notifications')).toEqual(resolveRouteAccess('/admin'));
  });
});
