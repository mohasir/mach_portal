import { describe, expect, it } from 'vitest';
import type { LocationSettings } from '@/components/shared/LocationFields/helpers';
import { isQuoteReadyToSend, toBuilderState, toCreateInput } from '../helpers';
import { emptyBuilderState, type QuoteBuilderState } from '../quotes.store';
import type { QuoteDetail } from '../types';

const off: LocationSettings = {
  enabled: false,
  country: null,
  depth: null,
  scope: null,
  areas: [],
  askAddress: false,
};
const on = (patch: Partial<LocationSettings> = {}): LocationSettings => ({
  enabled: true,
  country: 'US',
  depth: 2,
  scope: 'country',
  areas: [],
  askAddress: true,
  ...patch,
});

const ready = (patch: Partial<QuoteBuilderState> = {}): QuoteBuilderState => ({
  ...emptyBuilderState(0.5),
  clientId: 'c1',
  lines: [{ key: 'k', productId: 'p', quantity: 1, subtotal: 100, selections: {} }],
  region: 'NY',
  locality: 'Albany',
  address: '1 Main St',
  ...patch,
});

describe('isQuoteReadyToSend', () => {
  it('needs a client and at least one line whatever the settings', () => {
    expect(isQuoteReadyToSend(ready({ clientId: null }), off)).toBe(false);
    expect(isQuoteReadyToSend(ready({ lines: [] }), off)).toBe(false);
  });

  it('asks for no place when the function is off', () => {
    const empty = ready({ region: null, locality: null, address: '' });
    expect(isQuoteReadyToSend(empty, off)).toBe(true);
  });

  it('waits for the settings to load', () => {
    expect(isQuoteReadyToSend(ready(), undefined)).toBe(false);
  });

  it('follows the depth', () => {
    const place = ready({ locality: null, address: '' });
    expect(isQuoteReadyToSend(place, on({ depth: 2, askAddress: false }))).toBe(false);
    expect(isQuoteReadyToSend(place, on({ depth: 1, askAddress: false }))).toBe(true);
    const bare = ready({ region: null, locality: null, address: '' });
    expect(isQuoteReadyToSend(bare, on({ depth: 1, askAddress: false }))).toBe(false);
    expect(isQuoteReadyToSend(bare, on({ depth: 0, askAddress: false }))).toBe(true);
  });

  it('asks for the address only when the settings do', () => {
    const noAddress = ready({ address: '  ' });
    expect(isQuoteReadyToSend(noAddress, on({ askAddress: true }))).toBe(false);
    expect(isQuoteReadyToSend(noAddress, on({ askAddress: false }))).toBe(true);
  });
});

describe('stored country', () => {
  it('is not ready when the stored place belongs to another country than the settings', () => {
    const stale = ready({ country: 'US' });
    expect(isQuoteReadyToSend(stale, on({ country: 'NI' }))).toBe(false);
    expect(isQuoteReadyToSend(stale, on({ country: 'US' }))).toBe(true);
  });

  it('is ready again once the place is re-picked under the configured country', () => {
    const repicked = ready({ country: 'NI', region: 'MN', locality: 'Condega' });
    expect(isQuoteReadyToSend(repicked, on({ country: 'NI' }))).toBe(true);
  });

  it('does not block a stale quote at depth 0, where no place is asked', () => {
    const stale = ready({ country: 'US', region: null, locality: null, address: '' });
    const settings = on({ country: 'NI', depth: 0, askAddress: false });
    expect(isQuoteReadyToSend(stale, settings)).toBe(true);
  });

  it('does not judge the country of a new quote or with the function off', () => {
    expect(isQuoteReadyToSend(ready({ country: null }), on({ country: 'NI' }))).toBe(true);
    expect(isQuoteReadyToSend(ready({ country: 'US' }), off)).toBe(true);
  });
});

describe('place in the builder state', () => {
  it('drops a stale place from the payload so a shared region code is never reinterpreted', () => {
    const stale = ready({ country: 'US', region: 'CA', locality: 'Fresno' });
    const input = toCreateInput(stale, true, on({ country: 'NI', depth: 1 }));
    expect(input.region).toBeUndefined();
    expect(input.locality).toBeUndefined();
  });

  it('keeps the place when it belongs to the configured country', () => {
    const input = toCreateInput(
      ready({ country: 'NI', region: 'CA' }),
      true,
      on({ country: 'NI' }),
    );
    expect(input.region).toBe('CA');
  });

  it('is sent trimmed and without empty values', () => {
    const input = toCreateInput(ready({ address: '  1 Main St ', locality: null }), true);
    expect(input).toMatchObject({ region: 'NY', address: '1 Main St' });
    expect(input.locality).toBeUndefined();
    expect(input).not.toHaveProperty('state');
    expect(input).not.toHaveProperty('city');
  });

  it('loads from a saved quote, keeping a locality outside the dataset', () => {
    const detail = {
      clientId: 'c1',
      clientName: 'Ana',
      country: 'US',
      region: 'NY',
      locality: 'Bronx',
      address: null,
      charges: [],
      lines: [],
    } as unknown as QuoteDetail;
    expect(toBuilderState(detail)).toMatchObject({
      country: 'US',
      region: 'NY',
      locality: 'Bronx',
      address: '',
    });
  });
});
