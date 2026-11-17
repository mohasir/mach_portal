export type CountryCode = 'US' | 'NI';

export interface LevelName {
  es: string;
  en: string;
}

export interface Country {
  code: CountryCode;
  levels: [LevelName, LevelName];
}

export const COUNTRIES: Record<CountryCode, Country> = {
  US: {
    code: 'US',
    levels: [
      { es: 'estado', en: 'state' },
      { es: 'ciudad', en: 'city' },
    ],
  },
  NI: {
    code: 'NI',
    levels: [
      { es: 'departamento', en: 'department' },
      { es: 'municipio', en: 'municipality' },
    ],
  },
};

export function getCountry(code: string): Country | undefined {
  return Object.hasOwn(COUNTRIES, code) ? COUNTRIES[code as CountryCode] : undefined;
}
