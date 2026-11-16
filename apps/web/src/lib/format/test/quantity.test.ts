import { describe, expect, it } from 'vitest';
import { formatQuantity, unitNoun } from '../quantity';

const persona = { name: 'Persona', pluralName: 'Personas', code: 'pers' };
const hour = { name: 'Hora', pluralName: 'Horas', code: 'h' };
const kilo = { name: 'Kilogramo', pluralName: 'Kilogramos', code: 'kg' };
const fluidOunce = { name: 'Onza líquida', pluralName: 'Onzas líquidas', code: 'fl oz' };
const guest = { name: 'Guest', pluralName: 'Guests', code: 'gst' };

describe('formatQuantity', () => {
  it('uses the singular only for exactly 1', () => {
    expect(formatQuantity(1, persona)).toBe('1 persona');
    expect(formatQuantity(40, persona)).toBe('40 personas');
    expect(formatQuantity(0, persona)).toBe('0 personas');
    expect(formatQuantity(3, hour)).toBe('3 horas');
  });

  it('follows the same rule for units named in English', () => {
    expect(formatQuantity(1, guest)).toBe('1 guest');
    expect(formatQuantity(0, guest)).toBe('0 guests');
    expect(formatQuantity(2, guest)).toBe('2 guests');
  });

  it('lowers only the first letter of the name', () => {
    expect(formatQuantity(2, fluidOunce)).toBe('2 onzas líquidas');
    expect(formatQuantity(1, { name: 'Pack XL', pluralName: 'Packs XL', code: 'pxl' })).toBe(
      '1 pack XL',
    );
  });

  it('writes the code without pluralizing it in code mode', () => {
    expect(formatQuantity(5, kilo, 'code')).toBe('5 kg');
    expect(formatQuantity(1, kilo, 'code')).toBe('1 kg');
    expect(formatQuantity(0, fluidOunce, 'code')).toBe('0 fl oz');
  });

  it('keeps decimals as given', () => {
    expect(formatQuantity(1.5, kilo)).toBe('1.5 kilogramos');
  });
});

describe('unitNoun', () => {
  it('is the plural in lowercase unless the quantity is exactly 1', () => {
    expect(unitNoun(persona)).toBe('personas');
    expect(unitNoun(persona, 1)).toBe('persona');
    expect(unitNoun(fluidOunce, 3)).toBe('onzas líquidas');
  });
});
