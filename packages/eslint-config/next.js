import nextPlugin from '@next/eslint-plugin-next';
import { base } from './index.js';

/** @type {import('typescript-eslint').Config} */
export const next = [
  ...base,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
