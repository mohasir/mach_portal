import { describe, expect, it } from 'vitest';
import { parseArgs } from '../args';

describe('parseArgs', () => {
  it('reads the tenant slug', () => {
    expect(parseArgs(['--tenant=acme'])).toEqual({ kind: 'run', tenantSlug: 'acme' });
  });

  it('reads --all as a run over every organization', () => {
    expect(parseArgs(['--all'])).toEqual({ kind: 'all' });
  });

  it('refuses --all together with --tenant', () => {
    expect(() => parseArgs(['--all', '--tenant=acme'])).toThrow(/either --tenant=<slug> or --all/);
  });

  it('returns help for --help', () => {
    expect(parseArgs(['--help'])).toEqual({ kind: 'help' });
  });

  it('throws when --tenant is missing or empty', () => {
    expect(() => parseArgs([])).toThrow(/--tenant=<slug>/);
    expect(() => parseArgs(['--tenant='])).toThrow(/--tenant=<slug>/);
  });
});
