import { describe, expect, it } from 'vitest';
import { RESOURCES } from '../../constants/index';
import { RESOURCE_MODULE, moduleOfResource } from '../resourceModules';

describe('RESOURCE_MODULE', () => {
  it('only maps resources that exist', () => {
    const known = new Set<string>(Object.values(RESOURCES));
    for (const resource of Object.keys(RESOURCE_MODULE)) {
      expect(known.has(resource)).toBe(true);
    }
  });

  it('maps quote and event resources to their modules', () => {
    expect(moduleOfResource('quote')).toBe('quotes');
    expect(moduleOfResource('pipeline_preferences')).toBe('quotes');
    expect(moduleOfResource('payment')).toBe('events');
    expect(moduleOfResource('reschedule_reason')).toBe('events');
    expect(moduleOfResource('charge_type')).toBe('quotes');
  });

  it('leaves unmapped resources without a module', () => {
    for (const r of [
      'product',
      'price_tiers',
      'product_option',
      'tax_rates',
      'catalog_preferences',
      'client',
    ]) {
      expect(moduleOfResource(r)).toBeUndefined();
    }
  });
});
