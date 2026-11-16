import { describe, expect, it } from 'vitest';
import { SYSTEM_UNITS } from '@repo/schemas';
import { SEED_CATALOG } from '../catalog';
import { DEMO_TENANTS } from '../demo';
import { SEED_QUOTES } from '../quotes';

const LEGACY = /station|estaci|craft bar|crepe|pancake|popsicle|nachos|esquites|chocolate/i;
const unitCodes = new Set(SYSTEM_UNITS.map((u) => u.code));

describe('seed catalog is business-neutral', () => {
  it('gives every product a system unit, a category and tiers', () => {
    for (const catalog of [SEED_CATALOG, ...DEMO_TENANTS.map((t) => t.catalog)]) {
      for (const p of catalog) {
        expect(unitCodes.has(p.uomCode ?? ''), `${p.name} unit`).toBe(true);
        expect(p.category, `${p.name} category`).toBeTruthy();
        expect(p.tiers.length, `${p.name} tiers`).toBeGreaterThan(0);
      }
    }
  });

  it('carries no wording of a specific client in products, options or quotes', () => {
    const text = JSON.stringify([...DEMO_TENANTS.map((t) => t.catalog), SEED_CATALOG, SEED_QUOTES]);
    expect(text).not.toMatch(LEGACY);
  });

  it('each demo tenant sells a different catalog kind', () => {
    expect(DEMO_TENANTS.map((t) => t.catalogKind)).toEqual(['products', 'services']);
  });
});
