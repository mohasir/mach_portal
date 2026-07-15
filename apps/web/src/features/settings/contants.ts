import type { StateValue } from '@repo/schemas';

export const STATE_NAMES: Record<StateValue, string> = {
  NY: 'New York',
  NJ: 'New Jersey',
  CT: 'Connecticut',
};

// ISO 4217 code
export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
];

export const TAG_COLOR_PRESETS = [
  {
    label: 'Tag',
    colors: [
      '#f5222d',
      '#fa541c',
      '#fa8c16',
      '#faad14',
      '#a0d911',
      '#52c41a',
      '#13c2c2',
      '#1677ff',
      '#2f54eb',
      '#722ed1',
      '#eb2f96',
    ],
  },
];
