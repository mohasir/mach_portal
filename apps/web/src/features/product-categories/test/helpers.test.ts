import { describe, expect, it } from 'vitest';
import enCategories from '@/locales/en/productCategories.json';
import esCategories from '@/locales/es/productCategories.json';
import { canDeleteCategory, categoryOptions } from '../helpers';

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );

describe('canDeleteCategory', () => {
  it('allows deleting only a category without products', () => {
    expect(canDeleteCategory({ productCount: 0 })).toBe(true);
    expect(canDeleteCategory({ productCount: 2 })).toBe(false);
  });
});

describe('categoryOptions', () => {
  const active = [
    { id: 'a', name: 'Bebidas' },
    { id: 'b', name: 'Postres' },
  ];

  it('lists the active categories', () => {
    expect(categoryOptions(active)).toEqual([
      { value: 'a', label: 'Bebidas' },
      { value: 'b', label: 'Postres' },
    ]);
  });

  it('keeps the product category although it was deactivated', () => {
    expect(categoryOptions(active, { id: 'z', name: 'Vieja' }).map((o) => o.value)).toEqual([
      'a',
      'b',
      'z',
    ]);
    expect(categoryOptions(active, active[0])).toHaveLength(2);
  });
});

describe('productCategories locales', () => {
  it('has the same keys in es and en', () => {
    expect(keys(esCategories).sort()).toEqual(keys(enCategories).sort());
  });
});
