import { describe, expect, it } from 'vitest';
import { parseArgs } from '../args';

describe('parseArgs', () => {
  it('reads the tenant slug', () => {
    expect(parseArgs(['--tenant=acme'])).toEqual({ kind: 'run', tenantSlug: 'acme' });
  });

  it('returns help for --help', () => {
    expect(parseArgs(['--help'])).toEqual({ kind: 'help' });
  });

  it('throws when --tenant is missing or empty', () => {
    expect(() => parseArgs([])).toThrow(/--tenant=<slug>/);
    expect(() => parseArgs(['--tenant='])).toThrow(/--tenant=<slug>/);
  });
});
