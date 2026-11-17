import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fillVocabulary } from '../helpers';

const vocabulary = { item: 'servicio', items: 'servicios', Item: 'Servicio', Items: 'Servicios' };

describe('fillVocabulary', () => {
  it('replaces the four forms, every time they appear', () => {
    expect(
      fillVocabulary(
        '{{Items}}: crear un {{item}}, ver los {{items}} y el {{Item}} {{item}}',
        vocabulary,
      ),
    ).toBe('Servicios: crear un servicio, ver los servicios y el Servicio servicio');
  });

  it('leaves other text and unknown placeholders alone', () => {
    expect(fillVocabulary('Sin marcas {{other}} ni llaves', vocabulary)).toBe(
      'Sin marcas {{other}} ni llaves',
    );
  });
});

describe('help article content', () => {
  const dir = join(process.cwd(), 'src/features/support/content');

  it.each(['es', 'en'])('%s articles only use the vocabulary placeholders', (locale) => {
    for (const file of readdirSync(join(dir, locale))) {
      const body = readFileSync(join(dir, locale, file), 'utf-8');
      for (const [, name] of body.matchAll(/\{\{(\w+)\}\}/g)) {
        expect(['item', 'items', 'Item', 'Items'], `${locale}/${file}: {{${name}}}`).toContain(
          name,
        );
      }
    }
  });
});
