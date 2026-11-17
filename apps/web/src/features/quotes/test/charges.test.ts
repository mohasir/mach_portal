import { describe, expect, it } from 'vitest';
import { toBuilderState, toCreateInput } from '../helpers';
import {
  chargeRowLabel,
  chargesToSend,
  isRetiredChargeType,
  chargeValueError,
  effectiveCharges,
  offerableChargeTypes,
  toggleCharge,
  type BuilderCharge,
} from '../chargeHelpers';
import { emptyBuilderState } from '../quotes.store';
import type { QuoteDetail } from '../types';

const travel: BuilderCharge = {
  chargeTypeId: 't1',
  name: 'Traslado',
  kind: 'fixed',
  value: 5000,
};
const card: BuilderCharge = {
  chargeTypeId: 't2',
  name: 'Tarjeta',
  kind: 'percent',
  value: 0.03,
};

describe('toggleCharge', () => {
  const type = { id: 't1', name: 'Traslado', kind: 'fixed' as const, defaultValue: 5000 };

  it('applies a type with its default value', () => {
    expect(toggleCharge([], type, true)).toEqual([travel]);
  });

  it('does not apply the same type twice', () => {
    expect(toggleCharge([travel], type, true)).toEqual([travel]);
  });

  it('removes the charge of the type', () => {
    expect(toggleCharge([travel, card], type, false)).toEqual([card]);
  });
});

describe('offerableChargeTypes', () => {
  const types = [
    { id: 't1', name: 'Traslado', kind: 'fixed' as const, defaultValue: 5000 },
    { id: 't2', name: 'Tarjeta', kind: 'percent' as const, defaultValue: 0.03 },
  ];

  it('lists the active types', () => {
    expect(offerableChargeTypes(types, [])).toEqual(types);
  });

  it('adds the applied charges whose type is not offered, like a deactivated one', () => {
    const old: BuilderCharge = { chargeTypeId: 'gone', name: 'Viejo', kind: 'fixed', value: 100 };
    const rows = offerableChargeTypes(types, [old]);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toEqual({ id: 'gone', name: 'Viejo', kind: 'fixed', defaultValue: 100 });
  });
});

describe('effectiveCharges', () => {
  const orphan: BuilderCharge = { chargeTypeId: null, name: 'Huérfano', kind: 'fixed', value: 1 };

  it('keeps every charge while the add-on is off, since the API keeps them', () => {
    expect(effectiveCharges([travel, orphan], false)).toEqual([travel, orphan]);
  });

  it('drops a charge without a type while the add-on is on, since the API removes it', () => {
    expect(effectiveCharges([travel, orphan], true)).toEqual([travel]);
  });
});

describe('chargesToSend', () => {
  it('sends the type and the value of every charge', () => {
    expect(chargesToSend([travel, card])).toEqual([
      { chargeTypeId: 't1', value: 5000 },
      { chargeTypeId: 't2', value: 0.03 },
    ]);
  });

  it('skips a charge whose type no longer exists', () => {
    expect(chargesToSend([{ ...travel, chargeTypeId: null }])).toEqual([]);
  });
});

describe('isRetiredChargeType', () => {
  it('flags an applied type that is no longer offered, once the options have loaded', () => {
    const active = new Set(['t1']);
    expect(isRetiredChargeType('t2', active, false)).toBe(true);
    expect(isRetiredChargeType('t1', active, false)).toBe(false);
    expect(isRetiredChargeType('t2', new Set(), true)).toBe(false);
  });
});

describe('normalized percent values', () => {
  it('sends a percent rate rounded to the 5 decimals the API stores', () => {
    const sent = chargesToSend([{ ...card, value: 0.007 / 100 }]);
    expect(sent).toEqual([{ chargeTypeId: card.chargeTypeId, value: 0.00007 }]);
  });
});

describe('chargeValueError', () => {
  it('accepts whole cents for fixed and a rate above 0 up to 1 for percent', () => {
    expect(chargeValueError(travel)).toBe(false);
    expect(chargeValueError({ ...travel, value: 0 })).toBe(false);
    expect(chargeValueError(card)).toBe(false);
  });

  it('rejects a zero percent and fractional cents', () => {
    expect(chargeValueError({ ...card, value: 0 })).toBe(true);
    expect(chargeValueError({ ...travel, value: 10.5 })).toBe(true);
  });
});

describe('chargeRowLabel', () => {
  it('shows the rate of a percent charge next to its name', () => {
    expect(chargeRowLabel(travel)).toBe('Traslado');
    expect(chargeRowLabel(card)).toBe('Tarjeta (3%)');
    expect(chargeRowLabel({ ...card, value: 0.0875 })).toBe('Tarjeta (8.75%)');
  });
});

describe('builder state and input', () => {
  it('loads the charges of a saved quote', () => {
    const detail = {
      lines: [],
      charges: [
        {
          id: 'c1',
          chargeTypeId: 't1',
          name: 'Traslado',
          kind: 'fixed',
          value: 5000,
          amount: 5000,
        },
      ],
    } as unknown as QuoteDetail;
    expect(toBuilderState(detail).charges).toEqual([travel]);
  });

  it('always sends the full charge list, so the API does not delete them', () => {
    const state = { ...emptyBuilderState(0.5), charges: [travel, card] };
    expect(toCreateInput(state, true).charges).toEqual([
      { chargeTypeId: 't1', value: 5000 },
      { chargeTypeId: 't2', value: 0.03 },
    ]);
    expect(toCreateInput(emptyBuilderState(0.5), true).charges).toEqual([]);
  });
});
