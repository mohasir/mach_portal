import { describe, expect, it } from 'vitest';
import { FeatureUsageError, parseExpiryDate, parseFeatureArgs } from '../feature';

describe('parseExpiryDate', () => {
  it('stores the start of the next day in UTC', () => {
    expect(parseExpiryDate('2027-06-30').toISOString()).toBe('2027-07-01T00:00:00.000Z');
  });

  it('rolls over month, year and leap day', () => {
    expect(parseExpiryDate('2027-12-31').toISOString()).toBe('2028-01-01T00:00:00.000Z');
    expect(parseExpiryDate('2028-02-28').toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(parseExpiryDate('2028-02-29').toISOString()).toBe('2028-03-01T00:00:00.000Z');
  });

  it.each([
    '2027-6-30',
    '30-06-2027',
    '2027-06-30T00:00',
    '',
    'tomorrow',
    '2027-02-30',
    '2027-13-01',
    '2027-00-10',
  ])('rejects %j', (value) => {
    expect(() => parseExpiryDate(value)).toThrow(FeatureUsageError);
  });
});

describe('parseFeatureArgs', () => {
  it('parses list with a tenant', () => {
    expect(parseFeatureArgs(['list', '--tenant', 'acme'])).toEqual({
      command: 'list',
      tenantSlug: 'acme',
    });
  });

  it('parses set with every option, in both flag forms', () => {
    const parsed = parseFeatureArgs([
      'set',
      '--tenant=acme',
      '--key',
      'quotes',
      '--expires',
      '2027-06-30',
      '--price=1500',
      '--period',
      'yearly',
      '--currency',
      'usd',
    ]);
    expect(parsed).toEqual({
      command: 'set',
      tenantSlug: 'acme',
      key: 'quotes',
      expires: new Date('2027-07-01T00:00:00Z'),
      price: 1500,
      period: 'yearly',
      currency: 'USD',
    });
  });

  it('parses unset and ignores a bare "--" separator', () => {
    expect(parseFeatureArgs(['unset', '--', '--tenant', 'acme', '--key', 'events'])).toEqual({
      command: 'unset',
      tenantSlug: 'acme',
      key: 'events',
    });
  });

  it('accepts a zero price', () => {
    expect(
      parseFeatureArgs(['set', '--tenant', 'a', '--key', 'quotes', '--price', '0']).price,
    ).toBe(0);
  });

  it('clears stored values with never and none, which is distinct from leaving them out', () => {
    const parsed = parseFeatureArgs([
      'set',
      '--tenant',
      'acme',
      '--key',
      'quotes',
      '--expires',
      'never',
      '--price',
      'none',
      '--period=none',
      '--currency',
      'none',
    ]);
    expect(parsed).toEqual({
      command: 'set',
      tenantSlug: 'acme',
      key: 'quotes',
      expires: null,
      price: null,
      period: null,
      currency: null,
    });
    expect('expires' in parseFeatureArgs(['set', '--tenant', 'a', '--key', 'quotes'])).toBe(false);
  });

  it.each<[string, string[], RegExp]>([
    [
      'none on expires',
      ['set', '--tenant', 'a', '--key', 'quotes', '--expires', 'none'],
      /--expires/,
    ],
    ['never on price', ['set', '--tenant', 'a', '--key', 'quotes', '--price', 'never'], /--price/],
    [
      'never on period',
      ['set', '--tenant', 'a', '--key', 'quotes', '--period', 'never'],
      /--period/,
    ],
    [
      'never on currency',
      ['set', '--tenant', 'a', '--key', 'quotes', '--currency', 'never'],
      /--currency/,
    ],
    ['no command', [], /command/i],
    ['unknown command', ['drop', '--tenant', 'acme'], /command/i],
    ['missing tenant', ['list'], /--tenant/],
    ['empty tenant', ['list', '--tenant='], /--tenant/],
    ['tenant flag without value', ['list', '--tenant'], /--tenant/],
    ['set without key', ['set', '--tenant', 'acme'], /--key/],
    ['unset without key', ['unset', '--tenant', 'acme'], /--key/],
    ['key on list', ['list', '--tenant', 'acme', '--key', 'quotes'], /--key/],
    ['unknown flag', ['list', '--tenant', 'acme', '--nope', 'x'], /--nope/],
    ['repeated flag', ['list', '--tenant', 'a', '--tenant', 'b'], /--tenant/],
    ['positional argument', ['list', 'acme'], /acme/],
    [
      'bad expiry',
      ['set', '--tenant', 'a', '--key', 'quotes', '--expires', '2027-02-30'],
      /--expires/,
    ],
    ['decimal price', ['set', '--tenant', 'a', '--key', 'quotes', '--price', '10.5'], /--price/],
    ['negative price', ['set', '--tenant', 'a', '--key', 'quotes', '--price', '-1'], /--price/],
    ['bad period', ['set', '--tenant', 'a', '--key', 'quotes', '--period', 'weekly'], /--period/],
    ['bad currency', ['set', '--tenant', 'a', '--key', 'quotes', '--currency', 'US'], /--currency/],
    ['price on unset', ['unset', '--tenant', 'a', '--key', 'quotes', '--price', '1'], /--price/],
    [
      'expires on unset',
      ['unset', '--tenant', 'a', '--key', 'quotes', '--expires', '2027-06-30'],
      /--expires/,
    ],
    ['currency on list', ['list', '--tenant', 'a', '--currency', 'USD'], /--currency/],
  ])('rejects %s', (_label, argv, message) => {
    expect(() => parseFeatureArgs(argv)).toThrow(FeatureUsageError);
    expect(() => parseFeatureArgs(argv)).toThrow(message);
  });
});
