import { describe, expect, it } from 'vitest';
import { CATALOG_KINDS } from '@repo/schemas';
import enVocabulary from '@/locales/en/vocabulary.json';
import esVocabulary from '@/locales/es/vocabulary.json';
import { NEUTRAL_VOCABULARY_KEY, VOCABULARY_FORMS, resolveVocabulary } from '../vocabulary';

type Dictionary = Record<string, Record<string, string>>;
const dictionaries: Record<string, Dictionary> = { es: esVocabulary, en: enVocabulary };
const lookup =
  (dictionary: Dictionary) =>
  (key: string): string => {
    const [group, form] = key.split('.');
    return dictionary[group!]?.[form!] ?? key;
  };

describe('resolveVocabulary', () => {
  it('resolves the four forms of the kind in the language of the dictionary', () => {
    expect(resolveVocabulary('products', lookup(esVocabulary))).toEqual({
      item: 'producto',
      items: 'productos',
      Item: 'Producto',
      Items: 'Productos',
    });
    expect(resolveVocabulary('services', lookup(enVocabulary))).toEqual({
      item: 'service',
      items: 'services',
      Item: 'Service',
      Items: 'Services',
    });
  });

  it('falls back to the neutral words while the kind is unknown', () => {
    const vocabulary = resolveVocabulary(undefined, lookup(esVocabulary));
    expect(vocabulary).toEqual(
      resolveVocabulary(NEUTRAL_VOCABULARY_KEY as never, lookup(esVocabulary)),
    );
    expect(vocabulary.item).not.toBe('producto');
    expect(vocabulary.item).not.toBe('servicio');
  });
});

describe('vocabulary dictionaries', () => {
  const groups = [...CATALOG_KINDS, NEUTRAL_VOCABULARY_KEY];

  it('have identical key sets in es and en', () => {
    const shape = (dictionary: Dictionary) =>
      Object.fromEntries(
        Object.entries(dictionary).map(([group, forms]) => [group, Object.keys(forms).sort()]),
      );
    expect(shape(esVocabulary)).toEqual(shape(enVocabulary));
  });

  it.each(Object.keys(dictionaries))(
    '%s has the four forms for every kind and the neutral set',
    (lang) => {
      const dictionary = dictionaries[lang]!;
      expect(Object.keys(dictionary).sort()).toEqual([...groups].sort());
      for (const group of groups) {
        for (const form of VOCABULARY_FORMS) {
          expect(dictionary[group]?.[form], `${lang}.${group}.${form}`).toBeTruthy();
        }
      }
    },
  );

  it.each(Object.keys(dictionaries))('%s capitalized forms match their lowercase form', (lang) => {
    const dictionary = dictionaries[lang]!;
    for (const group of groups) {
      const forms = dictionary[group]!;
      expect(forms['Item']).toBe(forms['item']!.charAt(0).toUpperCase() + forms['item']!.slice(1));
      expect(forms['Items']).toBe(
        forms['items']!.charAt(0).toUpperCase() + forms['items']!.slice(1),
      );
    }
  });
});
