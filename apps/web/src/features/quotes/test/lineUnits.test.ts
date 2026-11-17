import { describe, expect, it } from 'vitest';
import { toBuilderState, toQuoteLineInputs } from '../helpers';
import { lineUnit, withCurrentUnitOnRepricing } from '../lineHelpers';
import type { QuoteDetail } from '../types';

const hour = { id: 'u-hour', name: 'Hora', pluralName: 'Horas', code: 'h', dimension: 'time' };
const person = {
  id: 'u-person',
  name: 'Persona',
  pluralName: 'Personas',
  code: 'p',
  dimension: 'count',
};

describe('lineUnit', () => {
  it('uses the unit stored on the line, not the product current one', () => {
    expect(lineUnit({ unit: hour }, { unit: person })).toBe(hour);
  });

  it('falls back to the product unit for a line added from the catalog', () => {
    expect(lineUnit({}, { unit: person })).toBe(person);
  });
});

describe('toQuoteLineInputs', () => {
  it('resends the stored uomId of an existing line and omits it on a new one', () => {
    const inputs = toQuoteLineInputs([
      { key: 'a', productId: 'p1', quantity: 2, subtotal: 100, selections: {}, uomId: 'u-hour' },
      { key: 'b', productId: 'p2', quantity: 1, subtotal: 50, selections: {} },
    ]);
    expect(inputs[0]!.uomId).toBe('u-hour');
    expect('uomId' in inputs[1]!).toBe(false);
  });
});

describe('toBuilderState', () => {
  it('keeps uomId and unit on lines loaded from a saved quote', () => {
    const detail = {
      lines: [
        {
          id: 'l1',
          productId: 'p1',
          quantity: 3,
          subtotal: 300,
          uomId: 'u-hour',
          unit: hour,
          selections: [],
        },
      ],
      charges: [],
    } as unknown as QuoteDetail;
    const [line] = toBuilderState(detail).lines;
    expect(line!.uomId).toBe('u-hour');
    expect(line!.unit).toEqual(hour);
  });
});

describe('withCurrentUnitOnRepricing', () => {
  const product = { uomId: 'u-person' };
  const frozen = { uomId: 'u-hour', unit: hour };

  it('drops the frozen unit when the quantity of a line in an old unit changes', () => {
    expect(
      withCurrentUnitOnRepricing(frozen, product, { quantity: 2, subtotal: 10 }),
    ).toStrictEqual({
      quantity: 2,
      subtotal: 10,
      uomId: undefined,
      unit: undefined,
    });
  });

  it('keeps the frozen unit when only the price is edited', () => {
    expect(withCurrentUnitOnRepricing(frozen, product, { subtotal: 10 })).toEqual({ subtotal: 10 });
  });

  it('leaves a line already in the current unit, or a new line, untouched', () => {
    const payload = { quantity: 2, subtotal: 10 };
    expect(withCurrentUnitOnRepricing({ uomId: 'u-person' }, product, payload)).toBe(payload);
    expect(withCurrentUnitOnRepricing({}, product, payload)).toBe(payload);
  });

  it('an unchanged existing line still resends its uomId', () => {
    const [input] = toQuoteLineInputs([
      { key: 'a', productId: 'p1', quantity: 2, subtotal: 100, selections: {}, ...frozen },
    ]);
    expect(input!.uomId).toBe('u-hour');
  });
});
