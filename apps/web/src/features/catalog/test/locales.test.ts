import { describe, expect, it } from 'vitest';
import esCatalog from '@/locales/es/catalog.json';
import enCatalog from '@/locales/en/catalog.json';
import esCommon from '@/locales/es/common.json';
import enCommon from '@/locales/en/common.json';

type Tree = { [key: string]: string | Tree };

const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );

describe('catalog and common locales', () => {
  it('have the same keys in es and en', () => {
    expect(keys(enCatalog).sort()).toEqual(keys(esCatalog).sort());
    expect(keys(enCommon).sort()).toEqual(keys(esCommon).sort());
  });

  it('label both product descriptions and the editor toolbar', () => {
    for (const catalog of [esCatalog, enCatalog]) {
      expect(keys(catalog)).toEqual(
        expect.arrayContaining([
          'product.form.shortDescription',
          'product.form.longDescription',
          'validation.shortDescriptionTooLong',
          'validation.longDescriptionTooLong',
          'option.form.description',
        ]),
      );
      expect(keys(catalog)).not.toContain('product.form.description');
    }
    for (const common of [esCommon, enCommon]) {
      expect(keys(common)).toEqual(
        expect.arrayContaining(['richText.bold', 'richText.link', 'richText.counter']),
      );
    }
  });
});
